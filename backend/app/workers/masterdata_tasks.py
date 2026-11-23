import asyncio

import structlog

from app.config import get_settings
from app.services.jobs.masterdata import read_configured_source, store_master_data
from app.workers.celery_app import celery_app
from app.workers.dependencies import worker_database

logger = structlog.get_logger(__name__)


async def run_masterdata_sync() -> None:
    settings = get_settings()
    if not settings.MASTERDATA_SOURCE:
        return
    try:
        data = await asyncio.to_thread(read_configured_source, settings)
        async with worker_database() as database:
            summaries = await store_master_data(
                database.session_factory,
                data,
                deactivate_missing=settings.MASTERDATA_DEACTIVATE_MISSING,
            )
    except Exception:
        logger.exception("masterdata_sync_failed", source=settings.MASTERDATA_SOURCE)
        raise
    logger.info(
        "masterdata_sync_completed",
        source=settings.MASTERDATA_SOURCE,
        summaries=[summary.model_dump() for summary in summaries],
    )


@celery_app.task(name="masterdata.sync", ignore_result=True)
def masterdata_sync_task() -> None:
    asyncio.run(run_masterdata_sync())
