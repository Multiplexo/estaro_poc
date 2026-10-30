"""Create database resources inside each task's event loop."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from sqlalchemy.exc import SQLAlchemyError

from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.services.shared.database import DatabaseService

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def extraction_repository() -> AsyncIterator[ExtractionRepository]:
    database = DatabaseService()
    try:
        async with database.session_factory() as session:
            yield ExtractionRepository(session)
    except (SQLAlchemyError, OSError):
        logger.exception("extraction_worker_database_failed")
        raise
    finally:
        await database.engine.dispose()
