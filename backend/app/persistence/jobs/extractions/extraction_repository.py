"""Async extraction job queries and lifecycle updates."""

from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.api.extractions import ExtractionRequest
from app.models.jobs.extraction import ExtractionStatus
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob

logger = structlog.get_logger(__name__)


class ExtractionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, request: ExtractionRequest) -> ExtractionJob:
        job = ExtractionJob(source_key=request.source_key)
        await self.save(job)
        return job

    async def get(self, job_id: UUID) -> ExtractionJob | None:
        try:
            return await self.session.get(ExtractionJob, job_id)
        except SQLAlchemyError:
            logger.exception("extraction_job_get_failed", job_id=str(job_id))
            raise

    async def claim(self, job_id: UUID) -> ExtractionJob | None:
        """Only one delivery may move a queued job into running state."""
        try:
            statement = (
                select(ExtractionJob)
                .where(
                    ExtractionJob.id == job_id,
                    ExtractionJob.status == ExtractionStatus.QUEUED,
                )
                .with_for_update(skip_locked=True)
            )
            job = (await self.session.exec(statement)).one_or_none()
            if job is None:
                await self.session.rollback()
                return None
            job.status = ExtractionStatus.RUNNING
            job.started_at = datetime.now(UTC)
            await self.save(job)
            return job
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("extraction_job_claim_failed", job_id=str(job_id))
            raise

    async def fail_queued(self, job_id: UUID) -> None:
        """Do not overwrite worker progress after an ambiguous publish failure."""
        try:
            statement = (
                select(ExtractionJob)
                .where(
                    ExtractionJob.id == job_id,
                    ExtractionJob.status == ExtractionStatus.QUEUED,
                )
                .with_for_update()
            )
            job = (await self.session.exec(statement)).one_or_none()
            if job is None:
                await self.session.rollback()
                return
            job.status = ExtractionStatus.FAILED
            job.error = "Queue submission failed"
            job.finished_at = datetime.now(UTC)
            await self.save(job)
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception(
                "extraction_job_enqueue_failure_save_failed", job_id=str(job_id)
            )
            raise

    async def save(self, job: ExtractionJob) -> None:
        job_id = job.id
        try:
            self.session.add(job)
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("extraction_job_save_failed", job_id=str(job_id))
            raise
