import os
from collections.abc import AsyncIterator, Callable, Iterator
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.main import app
from app.services.shared.database import get_session


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http_client:
        yield http_client


@pytest.fixture
def override_dependency() -> Iterator[Callable[..., AsyncMock]]:
    previous = app.dependency_overrides.copy()

    def override(dependency: Callable[..., Any], spec: type[Any]) -> AsyncMock:
        replacement = AsyncMock(spec=spec)

        async def provide() -> AsyncMock:
            return replacement

        app.dependency_overrides[dependency] = provide
        return replacement

    try:
        yield override
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


@pytest.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set TEST_DATABASE_URL to run PostgreSQL repository tests")
    url = make_url(database_url)
    if url.get_backend_name() != "postgresql":
        pytest.fail("TEST_DATABASE_URL must point to PostgreSQL")
    engine = create_async_engine(url.set(drivername="postgresql+asyncpg"))
    schema = f"test_{uuid4().hex}"
    try:
        async with engine.connect() as connection:
            transaction = await connection.begin()
            try:
                await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
                await connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
                await connection.run_sync(SQLModel.metadata.create_all)
                async with AsyncSession(
                    bind=connection,
                    expire_on_commit=False,
                    join_transaction_mode="create_savepoint",
                ) as session:
                    yield session
            finally:
                await transaction.rollback()
    finally:
        await engine.dispose()


@pytest.fixture
async def db_client(
    db_session: AsyncSession, client: AsyncClient
) -> AsyncIterator[AsyncClient]:
    previous = app.dependency_overrides.copy()

    async def provide_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_session] = provide_session
    try:
        yield client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
