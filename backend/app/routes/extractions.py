"""Submit dummy extractions and retrieve PostgreSQL job status."""

from typing import Annotated
from uuid import UUID

from app.dependencies import get_extraction_service
from app.models.api.extractions import ExtractionRequest
from app.models.jobs.extraction import ExtractionJobStatus
from app.services.jobs.extractions import ExtractionService
from fastapi import APIRouter, Depends, status

router = APIRouter()
ServiceDep = Annotated[ExtractionService, Depends(get_extraction_service)]


@router.post("", status_code=status.HTTP_202_ACCEPTED, operation_id="submit_extraction")
async def submit_extraction(
    payload: ExtractionRequest, service: ServiceDep
) -> ExtractionJobStatus:
    return await service.submit(payload)


@router.get("/{job_id}", operation_id="get_extraction_status")
async def get_extraction_status(
    job_id: UUID, service: ServiceDep
) -> ExtractionJobStatus:
    return await service.get(job_id)
