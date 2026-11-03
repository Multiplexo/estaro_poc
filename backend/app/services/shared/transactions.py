from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel.ext.asyncio.session import AsyncSession

logger = structlog.get_logger(__name__)


class TransactionService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @asynccontextmanager
    async def atomic(self) -> AsyncIterator[None]:
        try:
            yield
            await self._session.commit()
        except BaseException as exc:
            await self._session.rollback()
            if isinstance(exc, SQLAlchemyError):
                logger.exception("database_transaction_failed")
            raise
