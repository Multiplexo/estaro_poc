"""Run migrations using the application's PostgreSQL settings and metadata."""

import asyncio

import structlog
from sqlalchemy import URL, Connection, pool
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.schema import SchemaItem
from sqlmodel import SQLModel

import app.persistence  # noqa: F401 - Register SQLModel tables for autogeneration.
from alembic import context
from app.config import get_settings

logger = structlog.get_logger(__name__)
target_metadata = SQLModel.metadata
settings = get_settings()
database_url = URL.create(
    "postgresql+asyncpg",
    username=settings.POSTGRES_USER,
    password=settings.POSTGRES_PASSWORD,
    host=settings.POSTGRES_HOST,
    port=settings.POSTGRES_PORT,
    database=settings.POSTGRES_DB,
)


def include_object(
    schema_object: SchemaItem,
    name: str | None,
    object_type: str,
    reflected: bool,
    compare_to: SchemaItem | None,
) -> bool:
    # LangGraph migrates its own memory tables through AsyncPostgresStore.setup.
    if object_type == "table" and reflected and compare_to is None:
        return name not in {
            "store",
            "store_migrations",
            "store_vectors",
            "vector_migrations",
        }
    return True


def run_migrations_offline() -> None:
    """Generate PostgreSQL SQL without connecting to the database."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations(connection: Connection) -> None:
    """Run Alembic operations within the async connection's sync bridge."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Apply migrations using an async PostgreSQL connection."""
    engine = create_async_engine(database_url, poolclass=pool.NullPool)
    try:
        async with engine.connect() as connection:
            await connection.run_sync(run_migrations)
    except (SQLAlchemyError, OSError):
        logger.exception("database_migration_failed")
        raise
    finally:
        await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
