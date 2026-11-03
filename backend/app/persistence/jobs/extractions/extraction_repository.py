from uuid import UUID

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.jobs.extraction import ExtractionStatus
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob


class ExtractionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(
        self, job_id: UUID, *, for_update: bool = False
    ) -> ExtractionJob | None:
        return await self.session.get(
            ExtractionJob, job_id, with_for_update=for_update, populate_existing=True
        )

    async def get_latest(self, inquiry_id: UUID) -> ExtractionJob | None:
        statement = (
            select(ExtractionJob)
            .where(ExtractionJob.inquiry_id == inquiry_id)
            .order_by(
                col(ExtractionJob.created_at).desc(), col(ExtractionJob.id).desc()
            )
            .limit(1)
            .execution_options(populate_existing=True)
        )
        return (await self.session.exec(statement)).one_or_none()

    async def claim(self, job_id: UUID) -> ExtractionJob | None:
        statement = (
            select(ExtractionJob)
            .where(
                ExtractionJob.id == job_id,
                ExtractionJob.status == ExtractionStatus.QUEUED,
            )
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        )
        return (await self.session.exec(statement)).one_or_none()

    async def save(self, job: ExtractionJob) -> None:
        self.session.add(job)
        await self.session.flush()
