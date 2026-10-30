"""Redis transports tasks; PostgreSQL owns application job status."""

from celery import Celery

from app.config import get_settings

celery_app = Celery(
    "estaro",
    broker=get_settings().CELERY_BROKER_URL,
    include=["app.workers.extraction_tasks"],
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
)
