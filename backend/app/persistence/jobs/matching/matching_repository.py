from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.jobs.extraction import ExtractionStatus
from app.persistence.jobs.matching.schema.matching_job import MatchingJob


class MatchingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, extraction_job_id: UUID) -> MatchingJob | None:
        statement = (
            select(MatchingJob)
            .where(MatchingJob.extraction_job_id == extraction_job_id)
            .execution_options(populate_existing=True)
        )
        return (await self.session.exec(statement)).one_or_none()

    async def get_by_id(
        self, job_id: UUID, *, for_update: bool = False
    ) -> MatchingJob | None:
        return await self.session.get(
            MatchingJob, job_id, with_for_update=for_update, populate_existing=True
        )

    async def claim(self, job_id: UUID) -> MatchingJob | None:
        statement = (
            select(MatchingJob)
            .where(
                MatchingJob.id == job_id, MatchingJob.status == ExtractionStatus.QUEUED
            )
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        return (await self.session.exec(statement)).one_or_none()

    async def save(self, job: MatchingJob) -> None:
        self.session.add(job)
        await self.session.flush()
