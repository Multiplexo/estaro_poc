import hashlib
import json
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from langgraph.store.base import BaseStore
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg import AsyncConnection, Error
from psycopg.conninfo import make_conninfo
from psycopg.rows import DictRow, dict_row

from app.config import Settings
from app.models.jobs.matching import MatchCategory, MatchFeedback

logger = structlog.get_logger(__name__)


def matching_input_key(source: str) -> str:
    normalized = json.dumps(
        json.loads(source), sort_keys=True, ensure_ascii=False
    ).casefold()
    return hashlib.sha256(normalized.encode()).hexdigest()


class MatchingMemoryRepository:
    def __init__(self, store: BaseStore) -> None:
        self.store = store

    async def search(
        self, category: MatchCategory, query: str, limit: int = 10
    ) -> list[MatchFeedback]:
        query = query.strip().casefold()[:1000]
        terms = set(re.findall(r"\w+", query))
        if not terms:
            return []
        if not 1 <= limit <= 100:
            raise ValueError("Feedback search limit must be between 1 and 100")
        ranked: list[tuple[float, MatchFeedback]] = []
        offset = 0
        # The store has no embedding index. Search all pages lexically rather
        # than passing a query that an unindexed BaseStore would ignore.
        while True:
            records = await self.store.asearch(
                ("matching", "approved", category), limit=100, offset=offset
            )
            for record in records:
                feedback = MatchFeedback.model_validate(record.value)
                source = json.loads(feedback.source_input)
                text = " ".join(
                    [*feedback_values(source), feedback.note, feedback.entity_id]
                ).casefold()
                matched = terms & set(re.findall(r"\w+", text))
                if not matched:
                    continue
                score = len(matched) / len(terms) + (1 if query in text else 0)
                ranked.append((score, feedback))
            ranked.sort(key=lambda item: (item[0], item[1].created_at), reverse=True)
            del ranked[limit:]
            if len(records) < 100:
                return [feedback for _, feedback in ranked]
            offset += len(records)

    async def record(self, feedback: MatchFeedback) -> None:
        payload = feedback.model_dump(mode="json")
        await self.store.aput(
            ("matching", "feedback", feedback.category), str(feedback.id), payload
        )
        if feedback.reuse_for_matching:
            await self.store.aput(
                ("matching", "approved", feedback.category), str(feedback.id), payload
            )


def feedback_values(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [text for item in value.values() for text in feedback_values(item)]
    if isinstance(value, list):
        return [text for item in value for text in feedback_values(item)]
    return []


@asynccontextmanager
async def matching_memory(
    settings: Settings,
) -> AsyncIterator[MatchingMemoryRepository]:
    connection_info = make_conninfo(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        dbname=settings.POSTGRES_DB,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        connect_timeout=5,
    )
    try:
        # The library owns its schema and requires autocommit for concurrent indexes.
        # Serialize its idempotent setup across API and Celery processes.
        async with await AsyncConnection[DictRow].connect(
            connection_info, autocommit=True, row_factory=dict_row, prepare_threshold=0
        ) as connection:
            await connection.execute("SELECT pg_advisory_lock(493721681)")
            try:
                await AsyncPostgresStore(connection).setup()
            finally:
                await connection.execute("SELECT pg_advisory_unlock(493721681)")
        async with AsyncPostgresStore.from_conn_string(
            connection_info, pool_config={"min_size": 1, "max_size": 5}
        ) as store:
            yield MatchingMemoryRepository(store)
    except (Error, OSError):
        logger.exception("matching_memory_failed")
        raise
