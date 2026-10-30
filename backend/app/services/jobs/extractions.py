"""Submit extraction jobs and read durable status."""

from uuid import UUID

import structlog
from app.models.api.extractions import ExtractionRequest
from app.models.jobs.extraction import ExtractionJobStatus
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.workers.celery_app import celery_app
from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool
from kombu.exceptions import OperationalError
from redis.exceptions import RedisError

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
