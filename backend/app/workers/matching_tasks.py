import asyncio
from uuid import UUID

from app.workers.celery_app import celery_app
from app.workers.dependencies import matching_execution


async def run_matching(job_id: UUID) -> None:
    async with matching_execution() as service:
        await service.run(job_id)


@celery_app.task(name="matching.run", ignore_result=True)
def matching_task(job_id: str) -> None:
    asyncio.run(run_matching(UUID(job_id)))
