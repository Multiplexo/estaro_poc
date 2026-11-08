from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.jobs.extraction import ExtractionStatus
from app.persistence import ExtractionJob, Inquiry
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository

pytestmark = pytest.mark.integration


async def test_extraction_jobs_save_latest_and_claim(
    db_session: AsyncSession, inquiry: Inquiry
) -> None:
    repository = ExtractionRepository(db_session)
    old = ExtractionJob(
        inquiry_id=inquiry.id, created_at=datetime.now(UTC) - timedelta(days=1)
    )
    latest = ExtractionJob(inquiry_id=inquiry.id)
    await repository.save(old)
    await repository.save(latest)
    assert await repository.get_latest(inquiry.id) == latest
    assert await repository.get_latest(uuid4()) is None
    assert await repository.get(latest.id) == latest
    assert await repository.get(uuid4()) is None
    assert await repository.claim(latest.id) == latest
    latest.status = ExtractionStatus.RUNNING
    await repository.save(latest)
    assert await repository.claim(latest.id) is None
    assert await repository.claim(uuid4()) is None
