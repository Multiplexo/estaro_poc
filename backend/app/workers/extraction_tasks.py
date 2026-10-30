"""Thin Celery entry point for the extraction pipeline."""

import asyncio
from datetime import UTC, datetime
from uuid import UUID

import structlog

from app.models.jobs.extraction import ExtractionStatus
from app.pipelines.extraction.pipeline import run_pipeline
from app.workers.celery_app import celery_app
from app.workers.dependencies import extraction_repository

logger = structlog.get_logger(__name__)


async def run_extraction(job_id: UUID) -> None:
    async with extraction_repository() as repository:
        job = await repository.claim(job_id)
        if job is None:
            logger.info("extraction_job_skipped", job_id=str(job_id))
            return

        async def report_progress(step: str, completed_steps: int) -> None:
            job.current_step = step
            job.completed_steps = completed_steps
            await repository.save(job)

        try:
            await run_pipeline(report_progress)
            job.status = ExtractionStatus.SUCCEEDED
            job.current_step = None
            job.finished_at = datetime.now(UTC)
            await repository.save(job)
            logger.info("extraction_job_succeeded", job_id=str(job_id))
        except Exception:
            logger.exception("extraction_job_failed", job_id=str(job_id))
            # Rollback may expire ORM fields; reload before recording the failure.
            await repository.session.rollback()
            failed_job = await repository.get(job_id)
            if failed_job is not None:
                failed_job.status = ExtractionStatus.FAILED
                failed_job.error = "Extraction failed; see worker logs for details"
                failed_job.finished_at = datetime.now(UTC)
                await repository.save(failed_job)
            raise


@celery_app.task(name="extraction.run", ignore_result=True)
def extraction_task(job_id: str) -> None:
    """Bridge Celery's synchronous task entry into async database operations."""
    asyncio.run(run_extraction(UUID(job_id)))
