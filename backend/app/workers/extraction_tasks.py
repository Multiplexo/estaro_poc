import asyncio
from uuid import UUID

from app.workers.celery_app import celery_app
from app.workers.dependencies import extraction_execution


async def run_extraction(job_id: UUID) -> None:
    async with extraction_execution() as service:
        await service.run(job_id)


@celery_app.task(name="extraction.run", ignore_result=True)
def extraction_task(job_id: str) -> None:
    asyncio.run(run_extraction(UUID(job_id)))
