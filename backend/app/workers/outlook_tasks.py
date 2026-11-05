import asyncio

import structlog

from app.config import get_settings
from app.persistence.domain.outlook.outlook_repository import OutlookRepository
from app.services.factory import create_upload_service
from app.services.jobs.outlook import OutlookFetchService
from app.services.shared.minio import MinioService
from app.services.shared.outlook import create_outlook_client
from app.workers.celery_app import celery_app, publish_extraction, publish_matching
from app.workers.dependencies import worker_database

logger = structlog.get_logger(__name__)


async def run_outlook_fetch() -> None:
    settings = get_settings()
    if not settings.MS_FETCH_ENABLED:
        return
    try:
        async with (
            worker_database() as database,
            database.session_factory() as session,
            database.session_factory() as input_session,
            create_outlook_client(settings) as outlook,
        ):
            storage = MinioService(settings)
            service = OutlookFetchService(
                OutlookRepository(session),
                outlook,
                storage,
                create_upload_service(
                    input_session, storage, publish_extraction, publish_matching
                ),
            )
            await service.fetch()
    except Exception:
        logger.exception("outlook_fetch_failed")
        raise


@celery_app.task(name="outlook.fetch", ignore_result=True)
def outlook_fetch_task() -> None:
    asyncio.run(run_outlook_fetch())
