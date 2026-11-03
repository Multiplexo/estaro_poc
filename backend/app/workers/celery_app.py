"""Redis transports tasks; PostgreSQL owns application job status."""

from uuid import UUID

from celery import Celery
from fastapi.concurrency import run_in_threadpool
from kombu.exceptions import OperationalError
from redis.exceptions import RedisError

from app.config import get_settings
from app.models.jobs.extraction import ExtractionQueueUnavailable
from app.models.jobs.matching import MatchingQueueUnavailable

celery_app = Celery(
    "estaro",
    broker=get_settings().CELERY_BROKER_URL,
    include=[
        "app.workers.extraction_tasks",
        "app.workers.matching_tasks",
        "app.workers.cleanup_tasks",
    ],
)
celery_app.conf.update(
    task_default_queue="extraction",
    task_serializer="json",
    accept_content=["json"],
    task_ignore_result=True,
    task_store_errors_even_if_ignored=False,
    task_publish_retry=False,
    broker_connection_timeout=3,
    broker_transport_options={"socket_connect_timeout": 3, "socket_timeout": 3},
    worker_prefetch_multiplier=1,
    worker_hijack_root_logger=False,
    worker_redirect_stdouts=False,
    timezone="UTC",
    beat_schedule={
        "inquiry_cleanup": {
            "task": "inquiry.cleanup",
            "schedule": 60.0,
            "options": {"queue": "extraction"},
        }
    },
)


async def publish_matching(job_id: UUID) -> None:
    try:
        await run_in_threadpool(
            celery_app.send_task,
            "matching.run",
            args=[str(job_id)],
            queue="extraction",
            retry=False,
        )
    except (OperationalError, RedisError, OSError) as exc:
        raise MatchingQueueUnavailable("Matching queue unavailable") from exc


async def publish_extraction(job_id: UUID) -> None:
    try:
        await run_in_threadpool(
            celery_app.send_task,
            "extraction.run",
            args=[str(job_id)],
            task_id=str(job_id),
            queue="extraction",
            retry=False,
        )
    except (OperationalError, RedisError, OSError) as exc:
        raise ExtractionQueueUnavailable("Extraction queue unavailable") from exc
