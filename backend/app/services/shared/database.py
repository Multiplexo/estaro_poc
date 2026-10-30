"""Shared database engine and connection pool for repositories."""

from collections.abc import AsyncIterator

import structlog
from sqlalchemy import URL
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings

logger = structlog.get_logger(__name__)


class DatabaseService:
    """Provide the database engine; repositories own queries and sessions."""

    def __init__(self, engine: AsyncEngine | None = None) -> None:
        """Use an existing engine or create a pooled PostgreSQL engine."""
        if engine is not None:
            self.engine = engine
            self.session_factory = async_sessionmaker(
                engine, class_=AsyncSession, expire_on_commit=False
            )
            return

        settings = get_settings()
        connection_url = URL.create(
            "postgresql+asyncpg",
            username=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            database=settings.POSTGRES_DB,
        )
        try:
            self.engine = create_async_engine(
                connection_url,
                pool_pre_ping=True,
                pool_size=settings.POSTGRES_POOL_SIZE,
                max_overflow=settings.POSTGRES_MAX_OVERFLOW,
                pool_timeout=30,
                pool_recycle=1800,
            )
            self.session_factory = async_sessionmaker(
                self.engine, class_=AsyncSession, expire_on_commit=False
            )
            logger.info("database_engine_initialized")
        except SQLAlchemyError:
            logger.exception("database_engine_initialization_failed")
            raise


database_service = DatabaseService()


async def get_session() -> AsyncIterator[AsyncSession]:
    """Inject an async session and close it at the end of the request."""
    try:
        async with database_service.session_factory() as session:
            yield session
    except (SQLAlchemyError, OSError):
        logger.exception("database_request_failed")
        raise
