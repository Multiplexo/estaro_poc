from uuid import uuid4

from httpx import AsyncClient

from app.dependencies import get_matching_service
from app.persistence.jobs.matching.schema.matching_job import MatchingJob
from app.services.jobs.matching import MatchingService
from tests.types import OverrideDependency


async def test_matching_submit_and_status(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    service = override_dependency(get_matching_service, MatchingService)
    job = MatchingJob(
        extraction_job_id=uuid4(), inquiry_id=uuid4(), input_data={}
    ).to_model()
    service.submit.return_value = job
    service.get.return_value = job
    path = f"/extractions/{job.extraction_job_id}/matching"
    response = await client.post(path)
    assert response.status_code == 202
    assert response.json() == job.model_dump(mode="json")
    service.submit.assert_awaited_once_with(job.extraction_job_id)
    response = await client.get(path)
    assert response.status_code == 200
    assert response.json() == job.model_dump(mode="json")
    service.get.assert_awaited_once_with(job.extraction_job_id)
