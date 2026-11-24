from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.extractions.memory_repository import ReviewedMemoryRepository
from app.services.domain.inquiries import InquiryService
from app.services.factory import (
    create_extraction_service,
    create_matching_service,
    create_rule_service,
)
from app.services.jobs.execution import (
    ExtractionExecutionService,
    MatchingExecutionService,
)
from app.services.shared.database import DatabaseService
from app.services.shared.minio import MinioService
from app.services.shared.transactions import TransactionService
from app.workers.celery_app import publish_extraction, publish_matching

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def worker_database() -> AsyncIterator[DatabaseService]:
    database = DatabaseService()
    try:
        yield database
    except (SQLAlchemyError, OSError):
        logger.exception("worker_resource_failed")
        raise
    finally:
        await database.engine.dispose()


@asynccontextmanager
async def extraction_execution() -> AsyncIterator[ExtractionExecutionService]:
    async with worker_database() as database, database.session_factory() as session:
        settings = get_settings()
        extractions = create_extraction_service(
            session, publish_extraction, publish_matching
        )
        yield ExtractionExecutionService(
            extractions,
            extractions.matching,
            create_rule_service(session),
            MinioService(settings),
            settings,
            ReviewedMemoryRepository(database.session_factory),
            usage_sessions=database.session_factory,
        )


@asynccontextmanager
async def matching_execution() -> AsyncIterator[MatchingExecutionService]:
    async with worker_database() as database, database.session_factory() as session:
        yield MatchingExecutionService(
            create_matching_service(session, publish_matching),
            create_rule_service(session),
            database.session_factory,
            get_settings(),
        )


@asynccontextmanager
async def inquiry_cleanup() -> AsyncIterator[InquiryService]:
    async with worker_database() as database, database.session_factory() as session:
        yield InquiryService(
            InquiryRepository(session),
            MinioService(get_settings()),
            TransactionService(session),
        )
