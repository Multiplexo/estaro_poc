"""Submit extraction jobs and read durable status."""

from uuid import UUID

import structlog
from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool
from kombu.exceptions import OperationalError
from redis.exceptions import RedisError

from app.models.api.extractions import ExtractionRequest, ExtractionResultUpdate
from app.models.domain.extraction_review import ExtractionReviewConflict
from app.models.domain.inquiries import InquiryExtractionSnapshot
from app.models.domain.inquiry_mapping import inquiry_data_field_ids
from app.models.jobs.extraction import ExtractionJobStatus, extraction_field_ids
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


class ExtractionService:
    def __init__(self, repository: ExtractionRepository) -> None:
        self.repository = repository

    async def submit(self, request: ExtractionRequest) -> ExtractionJobStatus:
        job = await self.repository.create(request)
        response = job.to_model()
        try:
            await run_in_threadpool(
                celery_app.send_task,
                "extraction.run",
                args=[str(job.id)],
                task_id=str(job.id),
                queue="extraction",
                retry=False,
            )
        except (OperationalError, RedisError, OSError):
            logger.exception("extraction_enqueue_failed", job_id=str(job.id))
            await self.repository.fail_queued(job.id)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "message": "Extraction queue unavailable",
                    "job_id": str(job.id),
                },
            ) from None
        logger.info("extraction_job_queued", job_id=str(job.id))
        return response

    async def get(self, job_id: UUID) -> ExtractionJobStatus:
        job = await self.repository.get(job_id)
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Extraction job not found"
            )
        return job.to_model()

    async def get_result(self, job_id: UUID) -> InquiryExtractionSnapshot:
        result = await self.repository.get_result(job_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Extraction result not found",
            )
        return result

    async def update_result(
        self, job_id: UUID, request: ExtractionResultUpdate
    ) -> InquiryExtractionSnapshot:
        snapshot = await self.get_result(job_id)
        field_ids = extraction_field_ids(snapshot.result) | inquiry_data_field_ids(
            len(snapshot.result.positionen)
        )
        unknown_fields = request.fields.keys() - field_ids
        if unknown_fields:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "message": "Unknown extraction fields",
                    "fields": sorted(unknown_fields),
                },
            )

        try:
            result = await self.repository.update_result(job_id, request)
        except ExtractionReviewConflict as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Extraction review has changed; reload before saving",
            ) from exc
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Extraction result not found",
            )
        logger.info(
            "extraction_result_updated",
            job_id=str(job_id),
            revision=result.review.revision,
            field_count=len(request.fields),
        )
        return result
