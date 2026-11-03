from datetime import UTC, datetime
from uuid import UUID

import structlog
from fastapi import HTTPException

from app.models.api.extractions import ExtractionResultUpdate
from app.models.domain.extraction_review import ExtractionReview
from app.models.domain.inquiries import InquiryExtractionSnapshot
from app.models.domain.inquiry_data import InquiryData
from app.models.domain.inquiry_mapping import (
    inquiry_data_field_ids,
    map_extraction_to_inquiry,
)
from app.models.jobs.extraction import ACTIVE_JOB_STATUSES, extraction_field_ids
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.services.shared.transactions import TransactionService

logger = structlog.get_logger(__name__)


class ExtractionReviewService:
    def __init__(
        self,
        inquiries: InquiryRepository,
        extractions: ExtractionRepository,
        transactions: TransactionService,
    ) -> None:
        self.inquiries = inquiries
        self.extractions = extractions
        self.transactions = transactions

    async def get(self, job_id: UUID) -> InquiryExtractionSnapshot:
        snapshot = await self.inquiries.get_extraction(job_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Extraction result not found")
        return snapshot.to_model()

    async def lock_current(self, job_id: UUID) -> InquiryExtractionSnapshot:
        source = await self.get(job_id)
        inquiry = await self.inquiries.get_record(source.inquiry_id, for_update=True)
        if inquiry is None or inquiry.deletion_requested_at is not None:
            raise HTTPException(
                status_code=409, detail="Inquiry is no longer available"
            )
        snapshot = await self.inquiries.get_extraction(job_id, for_update=True)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Extraction result not found")
        latest = await self.inquiries.latest_extraction_id(source.inquiry_id)
        if latest != snapshot.id:
            raise HTTPException(
                status_code=409, detail="A newer extraction is available"
            )
        job = await self.extractions.get_latest(source.inquiry_id)
        if job is not None and job.status in ACTIVE_JOB_STATUSES:
            raise HTTPException(status_code=409, detail="Extraction is still running")
        return snapshot.to_model()

    async def save(
        self,
        source: InquiryExtractionSnapshot,
        review: ExtractionReview,
        data: InquiryData,
    ) -> InquiryExtractionSnapshot:
        if source.job_id is None:
            raise ValueError("Review must reference an extraction job")
        await self.inquiries.update_review(source.job_id, review)
        await self.inquiries.update_data(source.inquiry_id, data)
        return source.model_copy(update={"review": review})

    async def update(
        self, job_id: UUID, request: ExtractionResultUpdate
    ) -> InquiryExtractionSnapshot:
        async with self.transactions.atomic():
            source = await self.lock_current(job_id)
            if request.revision != source.review.revision:
                raise HTTPException(
                    status_code=409,
                    detail="Extraction review has changed; reload before saving",
                )
            allowed = extraction_field_ids(source.result) | inquiry_data_field_ids(
                len(source.result.positionen)
            )
            unknown = request.fields.keys() - allowed
            if unknown:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": "Unknown extraction fields",
                        "fields": sorted(unknown),
                    },
                )
            inquiry = await self.inquiries.get_record(source.inquiry_id)
            if inquiry is None:
                raise HTTPException(
                    status_code=409, detail="Inquiry is no longer available"
                )
            review = ExtractionReview(
                revision=source.review.revision + 1,
                fields={**source.review.fields, **request.fields},
                updated_at=datetime.now(UTC),
            )
            changed = {
                name
                for name, field in request.fields.items()
                if name not in source.review.fields
                or field.value != source.review.fields[name].value
            }
            data = map_extraction_to_inquiry(
                source.result,
                review,
                InquiryData.model_validate(inquiry.daten),
                updated_fields=changed,
            )
            result = await self.save(source, review, data)
        logger.info(
            "extraction_result_updated",
            job_id=str(job_id),
            revision=review.revision,
            field_count=len(request.fields),
        )
        return result
