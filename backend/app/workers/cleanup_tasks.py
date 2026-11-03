import asyncio

from app.workers.celery_app import celery_app
from app.workers.dependencies import inquiry_cleanup


async def run_cleanup() -> None:
    async with inquiry_cleanup() as service:
        await service.cleanup_pending()


@celery_app.task(name="inquiry.cleanup", ignore_result=True)
def cleanup_task() -> None:
    asyncio.run(run_cleanup())
