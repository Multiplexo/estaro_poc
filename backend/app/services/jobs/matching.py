from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from uuid import UUID

import structlog
from fastapi import HTTPException

from app.models.domain.extraction_review import ExtractionReview, ReviewedField
from app.models.domain.inquiries import InquiryExtractionSnapshot
from app.models.domain.inquiry_data import AdditionalPosition, InquiryData
from app.models.domain.inquiry_mapping import (
    map_article_to_inquiry,
    map_customer_to_inquiry,
    map_extraction_to_inquiry,
)
from app.models.jobs.extraction import (
    ACTIVE_JOB_STATUSES,
    ExtractionStatus,
    extraction_fields,
)
from app.models.jobs.matching import (
    AccessoryRequest,
    MatchingJobStatus,
    MatchingQueueUnavailable,
    MatchingResult,
    MatchSelectionRequest,
)
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.matching.matching_repository import MatchingRepository
from app.persistence.jobs.matching.schema.matching_job import MatchingJob
from app.services.domain.reviews import ExtractionReviewService
from app.services.shared.transactions import TransactionService

logger = structlog.get_logger(__name__)


def selection_review(
    source: InquiryExtractionSnapshot, data: InquiryData, request: MatchSelectionRequest
) -> ExtractionReview:
    aliases = {
        "kundeninformationen.name": "customer",
        "kundeninformationen.kunde": "customer_number",
        "kundeninformationen.ort.stadt": "customer_location",
    }
    if request.category == "article":
        prefix = f"positionen.{request.position_index}."
        aliases.update(
            {
                f"{prefix}bezeichnung": f"item-{request.position_index}-article",
                f"{prefix}bezeichnung2": f"item-{request.position_index}-material",
                f"{prefix}mengeneinheit": f"item-{request.position_index}-unit",
            }
        )
    fields = dict(source.review.fields)
    for path, match in data.matching_provenance.items():
        if match.category != request.category or match.entity_id != request.entity_id:
            continue
        if request.category == "article" and not path.startswith(
            f"positionen.{request.position_index}."
        ):
            continue
        field_id = aliases.get(path, f"data:{path}")
        fields[field_id] = ReviewedField(value=match.value, confirmed=False)
        if field_id != f"data:{path}":
            fields.pop(f"data:{path}", None)
    return ExtractionReview(
        revision=source.review.revision + 1, fields=fields, updated_at=datetime.now(UTC)
    )


class MatchingService:
    def __init__(
        self,
        repository: MatchingRepository,
        inquiries: InquiryRepository,
        articles: ArticleRepository,
        customers: CustomerRepository,
        reviews: ExtractionReviewService,
        transactions: TransactionService,
        publish: Callable[[UUID], Awaitable[None]],
    ) -> None:
        self.repository = repository
        self.inquiries = inquiries
        self.articles = articles
        self.customers = customers
        self.reviews = reviews
        self.transactions = transactions
        self._publish = publish

    async def get(self, extraction_job_id: UUID) -> MatchingJobStatus:
        job = await self.repository.get(extraction_job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Matching job not found")
        return job.to_model()

    async def prepare(
        self, source: InquiryExtractionSnapshot, data: InquiryData
    ) -> MatchingJob:
        if source.job_id is None:
            raise ValueError("Matching requires an extraction job")
        job = await self.repository.get(source.job_id)
        if job is not None and job.status in ACTIVE_JOB_STATUSES:
            return job
        if job is None:
            job = MatchingJob(
                extraction_job_id=source.job_id,
                inquiry_id=source.inquiry_id,
                input_data={},
            )
        job.input_data = map_extraction_to_inquiry(
            source.result, source.review, data
        ).model_dump(mode="json")
        job.input_revision = source.review.revision
        job.source_conflicts = [
            name
            for name, field in extraction_fields(source.result)
            if field.status == "conflict" and name not in source.review.fields
        ]
        job.status = ExtractionStatus.QUEUED
        job.result = None
        job.error = None
        job.started_at = None
        job.finished_at = None
        await self.repository.save(job)
        return job

    async def submit(self, extraction_job_id: UUID) -> MatchingJobStatus:
        async with self.transactions.atomic():
            source = await self.reviews.lock_current(extraction_job_id)
            inquiry = await self.inquiries.get_record(source.inquiry_id)
            if inquiry is None:
                raise HTTPException(
                    status_code=409, detail="Inquiry is no longer available"
                )
            job = await self.prepare(source, InquiryData.model_validate(inquiry.daten))
            response = job.to_model()
        if response.status != ExtractionStatus.QUEUED:
            return response
        try:
            await self._publish(response.id)
        except MatchingQueueUnavailable as exc:
            logger.exception("matching_enqueue_failed", job_id=str(response.id))
            await self.fail(response.id, queued_only=True)
            raise HTTPException(
                status_code=503, detail="Matching queue unavailable; retry matching"
            ) from exc
        logger.info("matching_job_queued", job_id=str(response.id))
        return response

    async def handoff(self, extraction_job_id: UUID) -> None:
        try:
            await self.submit(extraction_job_id)
        except Exception:
            logger.exception(
                "matching_handoff_failed", extraction_job_id=str(extraction_job_id)
            )

    async def select_candidate(
        self, extraction_job_id: UUID, request: MatchSelectionRequest
    ) -> InquiryExtractionSnapshot:
        try:
            async with self.transactions.atomic():
                source = await self.reviews.lock_current(extraction_job_id)
                if source.review.revision != request.revision:
                    raise HTTPException(
                        status_code=409, detail="Extraction review has changed"
                    )
                inquiry = await self.inquiries.get_record(source.inquiry_id)
                if inquiry is None:
                    raise HTTPException(
                        status_code=409, detail="Inquiry is no longer available"
                    )
                data = InquiryData.model_validate(inquiry.daten)
                data = await self._select(data, request)
                result = await self.reviews.save(
                    source, selection_review(source, data, request), data
                )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        logger.info(
            "matching_selection_saved",
            extraction_job_id=str(extraction_job_id),
            category=request.category,
            entity_id=request.entity_id,
        )
        return result

    async def set_accessory(
        self, extraction_job_id: UUID, request: AccessoryRequest
    ) -> InquiryExtractionSnapshot:
        """Add or remove a suggested accessory as an additional position."""
        try:
            async with self.transactions.atomic():
                source = await self.reviews.lock_current(extraction_job_id)
                if source.review.revision != request.revision:
                    raise HTTPException(
                        status_code=409, detail="Extraction review has changed"
                    )
                inquiry = await self.inquiries.get_record(source.inquiry_id)
                if inquiry is None:
                    raise HTTPException(
                        status_code=409, detail="Inquiry is no longer available"
                    )
                data = InquiryData.model_validate(inquiry.daten)
                data = await self._set_accessory(data, request)
                review = ExtractionReview(
                    revision=source.review.revision + 1,
                    fields=dict(source.review.fields),
                    updated_at=datetime.now(UTC),
                )
                result = await self.reviews.save(source, review, data)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        logger.info(
            "matching_accessory_saved",
            extraction_job_id=str(extraction_job_id),
            position_index=request.position_index,
            entity_id=request.entity_id,
            selected=request.selected,
        )
        return result

    async def _set_accessory(
        self, data: InquiryData, request: AccessoryRequest
    ) -> InquiryData:
        if request.position_index >= len(data.positionen or []):
            raise ValueError("Accessory requires a valid inquiry position")
        remaining = [
            position
            for position in data.zusatzpositionen
            if not (
                position.zu_position == request.position_index
                and position.entity_id == request.entity_id
            )
        ]
        if not request.selected:
            return data.model_copy(update={"zusatzpositionen": remaining})
        if not request.entity_id.isdigit():
            raise ValueError("Article ID must be numeric")
        article = await self.articles.get_article(int(request.entity_id))
        if article is None:
            raise ValueError("Article not found")
        accessory = AdditionalPosition(
            zu_position=request.position_index,
            entity_id=str(article.id),
            artikel=article.article_number,
            bezeichnung=article.description_1,
            bezeichnung2=article.description_2,
            menge="1",
            mengeneinheit=article.sales_unit_code or article.sales_unit_name,
            lagerbestand=str(article.stock_quantity),
            lagerinfoPOS=article.main_storage_location,
        )
        return data.model_copy(
            update={
                "zusatzpositionen": sorted(
                    [*remaining, accessory], key=lambda item: item.zu_position
                )
            }
        )

    async def _select(
        self, data: InquiryData, request: MatchSelectionRequest
    ) -> InquiryData:
        if request.category == "customer":
            customer = await self.customers.get_customer(UUID(request.entity_id))
            if customer is None:
                raise ValueError("Customer not found")
            return map_customer_to_inquiry(data, customer, origin="manual")
        if request.position_index is None:
            raise ValueError("Article selection requires a position")
        article = await self.articles.get_article(int(request.entity_id))
        if article is None:
            raise ValueError("Article not found")
        return map_article_to_inquiry(
            data, article, request.position_index, origin="manual"
        )

    async def claim(self, job_id: UUID) -> MatchingJobStatus | None:
        async with self.transactions.atomic():
            source = await self.repository.get_by_id(job_id)
            if source is None:
                return None
            inquiry = await self.inquiries.get_record(
                source.inquiry_id, for_update=True
            )
            if inquiry is None or inquiry.deletion_requested_at is not None:
                return None
            job = await self.repository.claim(job_id)
            if job is None:
                return None
            job.status = ExtractionStatus.RUNNING
            job.started_at = datetime.now(UTC)
            await self.repository.save(job)
            return job.to_model()

    async def complete(self, job_id: UUID, result: MatchingResult) -> None:
        async with self.transactions.atomic():
            job = await self.repository.get_by_id(job_id)
            if job is None:
                return
            inquiry = await self.inquiries.get_record(job.inquiry_id, for_update=True)
            if inquiry is None:
                return
            job = await self.repository.get_by_id(job_id, for_update=True)
            if job is None or job.status != ExtractionStatus.RUNNING:
                return
            snapshot = await self.inquiries.get_extraction(
                job.extraction_job_id, for_update=True
            )
            latest = await self.inquiries.latest_extraction_id(job.inquiry_id)
            if (
                snapshot is not None
                and latest == snapshot.id
                and inquiry.deletion_requested_at is None
                and snapshot.to_model().review.revision == job.input_revision
            ):
                source = snapshot.to_model()
                data = await self._apply_result(
                    InquiryData.model_validate(inquiry.daten), result
                )
                data = map_extraction_to_inquiry(
                    source.result,
                    source.review,
                    data,
                    updated_fields=set(source.review.fields),
                )
                await self.inquiries.update_data(job.inquiry_id, data)
                logger.info(
                    "matching_inquiry_updated",
                    job_id=str(job_id),
                    inquiry_id=str(job.inquiry_id),
                )
            else:
                logger.info("matching_inquiry_update_skipped_stale", job_id=str(job_id))
            job.result = result.model_dump(mode="json")
            job.status = ExtractionStatus.SUCCEEDED
            job.finished_at = datetime.now(UTC)
            await self.repository.save(job)

    async def _apply_result(
        self, data: InquiryData, result: MatchingResult
    ) -> InquiryData:
        if result.customer.selected is not None:
            customer = await self.customers.get_customer(
                UUID(result.customer.selected.entity_id)
            )
            if customer is None:
                raise ValueError("Matched customer not found")
            data = map_customer_to_inquiry(data, customer)
        for match in result.articles:
            if match.selected is None:
                continue
            article = await self.articles.get_article(int(match.selected.entity_id))
            if article is None:
                raise ValueError("Matched article not found")
            data = map_article_to_inquiry(data, article, match.position_index)
        return data

    async def fail(
        self, job_id: UUID, *, queued_only: bool = False, error: str | None = None
    ) -> None:
        async with self.transactions.atomic():
            job = await self.repository.get_by_id(job_id, for_update=True)
            if job is None or job.status not in ACTIVE_JOB_STATUSES:
                return
            if queued_only and job.status != ExtractionStatus.QUEUED:
                return
            job.status = ExtractionStatus.FAILED
            job.error = error or "Matching failed; see worker logs for details"
            job.finished_at = datetime.now(UTC)
            await self.repository.save(job)
