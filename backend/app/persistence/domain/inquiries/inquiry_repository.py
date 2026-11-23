"""Inquiry queries using the shared database service."""

from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import structlog
from sqlalchemy import and_, case, delete, func, or_, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import InstrumentedAttribute, selectinload
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.extraction_review import ExtractionReview
from app.models.domain.inquiries import (
    Inquiry,
    InquiryDocument,
    InquiryExtractionSnapshot,
    InquiryOverview,
    InquiryOverviewPage,
    InquiryOverviewQuery,
)
from app.models.domain.inquiry_data import InquiryData
from app.models.domain.pilot_metrics import ReviewedInquiry
from app.models.jobs.extraction import (
    CUSTOMER_FIELD_NAMES,
    INQUIRY_FIELD_NAMES,
    POSITION_FIELD_NAMES,
    ExtractionStatus,
)
from app.persistence.domain.inquiries.schema.inquiry import Inquiry as InquirySchema
from app.persistence.domain.inquiries.schema.inquiry import (
    InquiryDocument as DocumentSchema,
)
from app.persistence.domain.inquiries.schema.inquiry_extraction import (
    InquiryExtraction as ExtractionSchema,
)
from app.persistence.domain.inquiries.schema.inquiry_import import InquiryImport
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob
from app.persistence.jobs.matching.schema.matching_job import MatchingJob

logger = structlog.get_logger(__name__)


def _extracted_value(name: str) -> ColumnElement[str]:
    result = col(ExtractionSchema.result)
    current = (
        result["kundeninformationen"][CUSTOMER_FIELD_NAMES[name]]
        if name in CUSTOMER_FIELD_NAMES
        else result[INQUIRY_FIELD_NAMES[name]]
    )
    return case(
        (col(ExtractionSchema.schema_version) >= 3, current["value"].as_string()),
        else_=result[name]["value"].as_string(),
    )


def _reviewed_value(name: str) -> ColumnElement[str]:
    review = col(ExtractionSchema.review)
    return case(
        (
            review["fields"].has_key(name),
            func.coalesce(review["fields"][name]["value"].as_string(), ""),
        ),
        else_=_extracted_value(name),
    )


class InquiryRepository:
    """Retrieve inquiries with a session per operation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_overviews(self, query: InquiryOverviewQuery) -> InquiryOverviewPage:
        latest_job_id = (
            select(ExtractionJob.id)
            .where(ExtractionJob.inquiry_id == InquirySchema.id)
            .order_by(
                col(ExtractionJob.created_at).desc(), col(ExtractionJob.id).desc()
            )
            .limit(1)
            .correlate(InquirySchema)
            .scalar_subquery()
        )
        latest_id = (
            select(ExtractionSchema.id)
            .where(ExtractionSchema.inquiry_id == InquirySchema.id)
            .order_by(
                col(ExtractionSchema.created_at).desc(), col(ExtractionSchema.id).desc()
            )
            .limit(1)
            .correlate(InquirySchema)
            .scalar_subquery()
        )
        result = col(ExtractionSchema.result)
        review = col(ExtractionSchema.review)
        item_count = func.jsonb_array_length(
            case(
                (col(ExtractionSchema.schema_version) >= 3, result["positionen"]),
                else_=result["items"],
            )
        )
        item_indexes = (
            func.generate_series(0, item_count - 1)
            .table_valued("index")
            .render_derived()
        )
        unconfirmed_item = (
            select(item_indexes.c.index)
            .where(
                or_(
                    *(
                        review["fields"][
                            func.concat("item-", item_indexes.c.index, "-", name)
                        ]["confirmed"]
                        .as_boolean()
                        .is_not(True)
                        for name in POSITION_FIELD_NAMES
                    )
                )
            )
            .correlate(ExtractionSchema)
            .exists()
        )
        complete = and_(
            item_count > 0,
            *(
                review["fields"][name]["confirmed"].as_boolean().is_(True)
                for name in [*CUSTOMER_FIELD_NAMES, *INQUIRY_FIELD_NAMES]
            ),
            ~unconfirmed_item,
        )
        review_status = case(
            (complete, "reviewed"),
            (review["revision"].as_integer() > 0, "in_review"),
            else_="new",
        )
        customer = func.coalesce(_reviewed_value("customer"), "")
        email = func.coalesce(_reviewed_value("contact_email"), "")
        reference = func.coalesce(
            _reviewed_value("inquiry_number"),
            _reviewed_value("reference_number"),
            "",
        )
        statement = (
            select(InquirySchema, ExtractionSchema)
            .join(ExtractionSchema, col(ExtractionSchema.id) == latest_id)
            .join(ExtractionJob, col(ExtractionJob.id) == ExtractionSchema.job_id)
            .join(MatchingJob, col(MatchingJob.extraction_job_id) == ExtractionJob.id)
            .where(
                col(ExtractionJob.id) == latest_job_id,
                ExtractionJob.status == ExtractionStatus.SUCCEEDED,
                col(MatchingJob.status).in_(
                    [ExtractionStatus.SUCCEEDED, ExtractionStatus.FAILED]
                ),
                col(InquirySchema.deletion_requested_at).is_(None),
            )
        )
        if query.status != "all":
            statement = statement.where(review_status == query.status)
        term = query.search.strip()
        if term:
            document_matches = (
                select(DocumentSchema.id)
                .where(
                    DocumentSchema.inquiry_id == InquirySchema.id,
                    col(DocumentSchema.filename).icontains(term, autoescape=True),
                )
                .correlate(InquirySchema)
                .exists()
            )
            statement = statement.where(
                or_(
                    customer.icontains(term, autoescape=True),
                    email.icontains(term, autoescape=True),
                    reference.icontains(term, autoescape=True),
                    document_matches,
                )
            )
        ordering = (col(InquirySchema.created_at), col(InquirySchema.id))
        if query.sort == "newest":
            ordering = tuple(column.desc() for column in ordering)
        if query.sort == "customer":
            statement = statement.order_by(func.lower(customer))
        page = (
            statement.order_by(*ordering)
            .offset(query.offset)
            .limit(query.limit)
            .options(
                selectinload(
                    cast(
                        InstrumentedAttribute[list[DocumentSchema]],
                        cast(object, InquirySchema.documents),
                    )
                )
            )
        )
        try:
            total = (
                await self.session.exec(
                    select(func.count()).select_from(statement.subquery())
                )
            ).one()
            records = (await self.session.exec(page)).all()
            return InquiryOverviewPage(
                total=total,
                items=[
                    InquiryOverview(
                        **inquiry.to_model().model_dump(),
                        latest_extraction=extraction.to_model(),
                    )
                    for inquiry, extraction in records
                ],
            )
        except SQLAlchemyError:
            logger.exception(
                "inquiry_overview_list_failed", offset=query.offset, limit=query.limit
            )
            raise

    async def delete_inquiry(self, inquiry_id: UUID) -> None:
        try:
            await self.session.exec(
                delete(InquirySchema).where(col(InquirySchema.id) == inquiry_id)
            )
            await self.session.flush()
        except SQLAlchemyError:
            logger.exception("inquiry_delete_failed", inquiry_id=str(inquiry_id))
            raise

    async def get_inquiry(self, inquiry_id: UUID) -> Inquiry | None:
        """Return an inquiry and its relationships, or None when absent."""
        try:
            statement = (
                select(InquirySchema)
                .where(InquirySchema.id == inquiry_id)
                .options(
                    selectinload(
                        cast(
                            InstrumentedAttribute[list[DocumentSchema]],
                            cast(object, InquirySchema.documents),
                        )
                    )
                )
            )
            record = (await self.session.exec(statement)).one_or_none()
            return record.to_model() if record is not None else None
        except SQLAlchemyError:
            logger.exception("inquiry_get_failed", inquiry_id=str(inquiry_id))
            raise

    async def list_inquiries(self, offset: int = 0, limit: int = 100) -> list[Inquiry]:
        """Return a page ordered by creation time and UUID."""
        if offset < 0 or limit < 1:
            raise ValueError("offset must be non-negative and limit must be positive")

        try:
            statement = (
                select(InquirySchema)
                .options(
                    selectinload(
                        cast(
                            InstrumentedAttribute[list[DocumentSchema]],
                            cast(object, InquirySchema.documents),
                        )
                    )
                )
                .order_by(col(InquirySchema.created_at), col(InquirySchema.id))
                .offset(offset)
                .limit(limit)
            )
            return [
                record.to_model()
                for record in (await self.session.exec(statement)).all()
            ]
        except SQLAlchemyError:
            logger.exception("inquiry_list_failed", offset=offset, limit=limit)
            raise

    async def get_document(self, document_id: UUID) -> InquiryDocument | None:
        """Return a document by UUID, or None when absent."""
        try:
            record = await self.session.get(DocumentSchema, document_id)
            return record.to_model() if record is not None else None
        except SQLAlchemyError:
            logger.exception(
                "inquiry_document_get_failed", document_id=str(document_id)
            )
            raise

    async def list_documents(self, inquiry_id: UUID) -> list[InquiryDocument]:
        try:
            statement = (
                select(DocumentSchema)
                .where(DocumentSchema.inquiry_id == inquiry_id)
                .order_by(col(DocumentSchema.filename), col(DocumentSchema.id))
            )
            return [
                document.to_model()
                for document in (await self.session.exec(statement)).all()
            ]
        except SQLAlchemyError:
            logger.exception("inquiry_document_list_failed", inquiry_id=str(inquiry_id))
            raise

    async def list_reviewed(self) -> list[ReviewedInquiry]:
        """Latest reviewed extraction of every inquiry that is not being deleted."""
        statement = (
            select(ExtractionSchema, InquirySchema)
            .join(InquirySchema, col(InquirySchema.id) == ExtractionSchema.inquiry_id)
            .where(
                col(InquirySchema.deletion_requested_at).is_(None),
                ExtractionSchema.review["revision"].as_integer() > 0,
            )
            .order_by(
                col(ExtractionSchema.created_at).desc(),
                col(ExtractionSchema.id).desc(),
            )
        )
        try:
            rows = (await self.session.exec(statement)).all()
        except SQLAlchemyError:
            logger.exception("reviewed_inquiry_list_failed")
            raise
        latest: dict[UUID, ReviewedInquiry] = {}
        for extraction, inquiry in rows:
            if extraction.inquiry_id in latest:
                continue
            snapshot = extraction.to_model()
            latest[extraction.inquiry_id] = ReviewedInquiry(
                reviewed_at=snapshot.review.updated_at or snapshot.created_at,
                extraction=snapshot.result,
                review=snapshot.review,
                data=InquiryData.model_validate(inquiry.daten),
            )
        return list(latest.values())

    async def list_extractions(
        self, inquiry_id: UUID, offset: int = 0, limit: int = 100
    ) -> list[InquiryExtractionSnapshot]:
        if offset < 0 or limit < 1:
            raise ValueError("offset must be non-negative and limit must be positive")

        try:
            statement = (
                select(ExtractionSchema)
                .where(ExtractionSchema.inquiry_id == inquiry_id)
                .order_by(
                    col(ExtractionSchema.created_at).desc(),
                    col(ExtractionSchema.id).desc(),
                )
                .offset(offset)
                .limit(limit)
            )
            return [
                record.to_model()
                for record in (await self.session.exec(statement)).all()
            ]
        except SQLAlchemyError:
            logger.exception(
                "inquiry_extraction_list_failed", inquiry_id=str(inquiry_id)
            )
            raise

    async def get_record(
        self, inquiry_id: UUID, *, for_update: bool = False
    ) -> InquirySchema | None:
        return await self.session.get(
            InquirySchema,
            inquiry_id,
            with_for_update=for_update,
            populate_existing=True,
        )

    async def save(self, inquiry: InquirySchema) -> None:
        self.session.add(inquiry)
        await self.session.flush()

    async def save_document(self, document: DocumentSchema) -> None:
        self.session.add(document)
        await self.session.flush()

    async def get_import(self, import_key: str) -> InquiryImport | None:
        try:
            return await self.session.get(
                InquiryImport, import_key, populate_existing=True
            )
        except SQLAlchemyError:
            logger.exception("inquiry_import_get_failed", import_key=import_key)
            raise

    async def register_import(self, import_key: str, inquiry_id: UUID) -> None:
        statement = insert(InquiryImport).values(
            import_key=import_key, inquiry_id=inquiry_id, prepared=False
        )
        statement = statement.on_conflict_do_update(
            index_elements=["import_key"],
            set_={"inquiry_id": inquiry_id},
            where=and_(
                col(InquiryImport.prepared).is_(False),
                col(InquiryImport.inquiry_id).is_(None),
            ),
        ).returning(col(InquiryImport.import_key))
        try:
            if (await self.session.execute(statement)).scalar_one_or_none() is None:
                raise ValueError("Email import is already registered")
        except SQLAlchemyError:
            logger.exception(
                "inquiry_import_registration_failed", import_key=import_key
            )
            raise

    async def mark_import_prepared(self, inquiry_id: UUID) -> None:
        try:
            await self.session.execute(
                update(InquiryImport)
                .where(col(InquiryImport.inquiry_id) == inquiry_id)
                .values(prepared=True)
            )
        except SQLAlchemyError:
            logger.exception(
                "inquiry_import_preparation_failed", inquiry_id=str(inquiry_id)
            )
            raise

    async def get_extraction(
        self, job_id: UUID, *, for_update: bool = False
    ) -> ExtractionSchema | None:
        statement = (
            select(ExtractionSchema)
            .where(ExtractionSchema.job_id == job_id)
            .execution_options(populate_existing=True)
        )
        if for_update:
            statement = statement.with_for_update()
        return (await self.session.exec(statement)).one_or_none()

    async def latest_extraction_id(self, inquiry_id: UUID) -> UUID | None:
        statement = (
            select(ExtractionSchema.id)
            .where(ExtractionSchema.inquiry_id == inquiry_id)
            .order_by(
                col(ExtractionSchema.created_at).desc(), col(ExtractionSchema.id).desc()
            )
            .limit(1)
        )
        return (await self.session.exec(statement)).one_or_none()

    async def save_extraction(self, snapshot: ExtractionSchema) -> None:
        self.session.add(snapshot)
        await self.session.flush()

    async def update_review(self, job_id: UUID, review: ExtractionReview) -> None:
        record = await self.get_extraction(job_id)
        if record is None:
            raise ValueError("Extraction result not found")
        record.review = review.model_dump(mode="json")
        await self.save_extraction(record)

    async def update_data(self, inquiry_id: UUID, data: InquiryData) -> None:
        record = await self.get_record(inquiry_id)
        if record is None:
            raise ValueError("Inquiry not found")
        record.daten = data.model_dump(mode="json")
        await self.save(record)

    async def pending_deletions(self, limit: int = 100) -> list[UUID]:
        statement = (
            select(InquirySchema.id)
            .where(
                col(InquirySchema.deletion_requested_at).is_not(None),
                or_(
                    col(InquirySchema.deletion_retry_at).is_(None),
                    col(InquirySchema.deletion_retry_at) <= datetime.now(UTC),
                ),
            )
            .order_by(col(InquirySchema.deletion_retry_at), col(InquirySchema.id))
            .limit(limit)
        )
        return list((await self.session.exec(statement)).all())

    async def has_extraction_jobs(self, inquiry_id: UUID) -> bool:
        statement = select(
            select(ExtractionJob.id)
            .where(ExtractionJob.inquiry_id == inquiry_id)
            .exists()
        )
        return (await self.session.exec(statement)).one()

    async def uploads_without_jobs(
        self, created_before: datetime, limit: int = 100
    ) -> list[UUID]:
        has_jobs = (
            select(ExtractionJob.id)
            .where(ExtractionJob.inquiry_id == InquirySchema.id)
            .exists()
        )
        has_document = (
            select(DocumentSchema.id)
            .where(
                DocumentSchema.inquiry_id == InquirySchema.id,
                col(DocumentSchema.source_key).is_not(None),
            )
            .exists()
        )
        has_snapshot = (
            select(ExtractionSchema.id)
            .where(ExtractionSchema.inquiry_id == InquirySchema.id)
            .exists()
        )
        statement = (
            select(InquirySchema.id)
            .where(
                col(InquirySchema.created_at) < created_before,
                col(InquirySchema.deletion_requested_at).is_(None),
                has_document,
                ~has_jobs,
                ~has_snapshot,
                col(InquirySchema.daten) == {},
            )
            .order_by(col(InquirySchema.created_at), col(InquirySchema.id))
            .limit(limit)
        )
        return list((await self.session.exec(statement)).all())
