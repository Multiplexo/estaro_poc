from uuid import uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.jobs.extraction import ExtractionStatus
from app.persistence import ExtractionJob, Inquiry, MatchingJob
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.persistence.jobs.matching.matching_repository import MatchingRepository

pytestmark = pytest.mark.integration


async def test_matching_jobs_save_lookup_and_claim(
    db_session: AsyncSession, inquiry: Inquiry
) -> None:
    extraction = ExtractionJob(inquiry_id=inquiry.id)
    await ExtractionRepository(db_session).save(extraction)
    repository = MatchingRepository(db_session)
    job = MatchingJob(
        extraction_job_id=extraction.id, inquiry_id=inquiry.id, input_data={}
    )
    await repository.save(job)
    assert await repository.get(extraction.id) == job
    assert await repository.get_by_id(job.id) == job
    assert await repository.get(uuid4()) is None
    assert await repository.get_by_id(uuid4()) is None
    assert await repository.claim(job.id) == job
    job.status = ExtractionStatus.SUCCEEDED
    await repository.save(job)
    assert await repository.claim(job.id) is None
    assert await repository.claim(uuid4()) is None
