"""Inquiry queries using the shared database service."""

from typing import cast
from uuid import UUID

import structlog
from sqlalchemy import and_, case, delete, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import InstrumentedAttribute, selectinload
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.inquiries import (
    Inquiry,
    InquiryDocument,
    InquiryExtractionSnapshot,
    InquiryOverview,
    InquiryOverviewPage,
    InquiryOverviewQuery,
)
from app.models.jobs.extraction import ExtractedItem, InquiryExtraction
from app.persistence.domain.inquiries.schema.inquiry import Inquiry as InquirySchema
from app.persistence.domain.inquiries.schema.inquiry import (
    InquiryDocument as DocumentSchema,
)
from app.persistence.domain.inquiries.schema.inquiry_extraction import (
    InquiryExtraction as ExtractionSchema,
)

logger = structlog.get_logger(__name__)


def _reviewed_value(name: str) -> ColumnElement[str]:
    review = col(ExtractionSchema.review)
    return case(
        (
            review["fields"].has_key(name),
            func.coalesce(review["fields"][name]["value"].as_string(), ""),
        ),
        else_=col(ExtractionSchema.result)[name]["value"].as_string(),
    )


class InquiryRepository:
    """Retrieve inquiries with a session per operation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_overviews(self, query: InquiryOverviewQuery) -> InquiryOverviewPage:
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
        item_count = func.jsonb_array_length(result["items"])
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
                        for name in ExtractedItem.model_fields
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
                for name in InquiryExtraction.model_fields
                if name != "items"
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
        statement = select(InquirySchema, ExtractionSchema).join(
            ExtractionSchema, col(ExtractionSchema.id) == latest_id
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
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
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
