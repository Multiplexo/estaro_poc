from httpx import AsyncClient

from app.dependencies import get_extraction_service, get_upload_service
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob
from app.services.jobs.extractions import ExtractionService
from app.services.jobs.uploads import ExtractionUploadService
from tests.types import OverrideDependency


async def test_extraction_upload_and_status(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    upload = override_dependency(get_upload_service, ExtractionUploadService)
    service = override_dependency(get_extraction_service, ExtractionService)
    job = ExtractionJob().to_model()
    upload.submit.return_value = job
    service.get.return_value = job
    response = await client.post(
        "/extractions", files={"file": ("inquiry.pdf", b"%PDF-test", "application/pdf")}
    )
    assert response.status_code == 202
    assert response.json() == job.model_dump(mode="json")
    assert upload.submit.await_args.args[0].filename == "inquiry.pdf"
    response = await client.get(f"/extractions/{job.id}")
    assert response.status_code == 200
    assert response.json() == job.model_dump(mode="json")
    service.get.assert_awaited_once_with(job.id)


async def test_upload_requires_file(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    service = override_dependency(get_upload_service, ExtractionUploadService)
    response = await client.post("/extractions")
    assert response.status_code == 422
    service.submit.assert_not_awaited()
