from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.dependencies import (
    get_extraction_service,
    get_review_service,
    get_upload_service,
)
from app.models.api.extractions import ExtractionResultUpdate
from app.models.domain.inquiries import InquiryExtractionSnapshot
from app.models.jobs.extraction import ExtractionJobStatus
from app.services.domain.reviews import ExtractionReviewService
from app.services.jobs.extractions import ExtractionService
from app.services.jobs.uploads import ExtractionUploadService

router = APIRouter()
ServiceDep = Annotated[ExtractionService, Depends(get_extraction_service)]
ReviewServiceDep = Annotated[ExtractionReviewService, Depends(get_review_service)]


@router.post("", status_code=status.HTTP_202_ACCEPTED, operation_id="extraction")
async def submit_extraction(
    file: Annotated[UploadFile, File()],
    service: Annotated[ExtractionUploadService, Depends(get_upload_service)],
) -> ExtractionJobStatus:
    return await service.submit(file)


@router.get("/{job_id}", operation_id="get_extraction_status")
async def get_extraction_status(
    job_id: UUID, service: ServiceDep
) -> ExtractionJobStatus:
    return await service.get(job_id)


@router.get("/{job_id}/result", operation_id="get_extraction_result")
async def get_extraction_result(
    job_id: UUID, service: ReviewServiceDep
) -> InquiryExtractionSnapshot:
    return await service.get(job_id)


@router.patch("/{job_id}/result", operation_id="update_extraction_result")
async def update_extraction_result(
    job_id: UUID, request: ExtractionResultUpdate, service: ReviewServiceDep
) -> InquiryExtractionSnapshot:
    return await service.update(job_id, request)
