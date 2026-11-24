from collections.abc import Mapping
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence.jobs.usage.schema.ai_usage import AIUsage

logger = structlog.get_logger(__name__)


def usage_totals(usage: Mapping[str, Any]) -> tuple[int, int]:
    """Sum LangChain usage metadata (per model) into input and output tokens."""
    return (
        sum(int(entry.get("input_tokens", 0)) for entry in usage.values()),
        sum(int(entry.get("output_tokens", 0)) for entry in usage.values()),
    )


async def record_usage(
    sessions: async_sessionmaker[AsyncSession],
    *,
    job_kind: str,
    job_id: UUID,
    inquiry_id: UUID | None,
    usage: Mapping[str, Any],
    succeeded: bool,
) -> None:
    """Store token usage per model; never fails the job that caused it."""
    rows = [
        AIUsage(
            job_kind=job_kind,
            job_id=job_id,
            inquiry_id=inquiry_id,
            model=model,
            input_tokens=int(entry.get("input_tokens", 0)),
            output_tokens=int(entry.get("output_tokens", 0)),
            succeeded=succeeded,
        )
        for model, entry in usage.items()
        if entry.get("input_tokens") or entry.get("output_tokens")
    ]
    if not rows:
        return
    try:
        async with sessions() as session:
            session.add_all(rows)
            await session.commit()
    except SQLAlchemyError:
        logger.exception("ai_usage_record_failed", job_id=str(job_id))


class UsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self) -> list[AIUsage]:
        try:
            return list((await self.session.exec(select(AIUsage))).all())
        except SQLAlchemyError:
            logger.exception("ai_usage_list_failed")
            raise
