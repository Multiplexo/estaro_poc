from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import (
    get_feedback_service,
    get_matching_memory,
    get_matching_service,
)
from app.models.domain.inquiries import InquiryExtractionSnapshot
from app.models.jobs.matching import (
    MatchFeedback,
    MatchFeedbackRequest,
    MatchingJobStatus,
    MatchSelectionRequest,
)
from app.persistence.jobs.matching.memory_repository import (
    MatchingMemoryRepository,
)
from app.services.jobs.matching import MatchingService
from app.services.jobs.matching_feedback import MatchingFeedbackService

router = APIRouter()
ServiceDep = Annotated[MatchingService, Depends(get_matching_service)]


@router.get("/{job_id}/matching", operation_id="get_matching_status")
async def get_matching_status(job_id: UUID, service: ServiceDep) -> MatchingJobStatus:
    return await service.get(job_id)


@router.post("/{job_id}/matching", status_code=202, operation_id="submit_matching")
async def submit_matching(job_id: UUID, service: ServiceDep) -> MatchingJobStatus:
    return await service.submit(job_id)


@router.put("/{job_id}/matching/selection", operation_id="select_matching_candidate")
async def select_matching_candidate(
    job_id: UUID, request: MatchSelectionRequest, service: ServiceDep
) -> InquiryExtractionSnapshot:
    return await service.select_candidate(job_id, request)


@router.post(
    "/{job_id}/matching/feedback",
    status_code=201,
    operation_id="confirm_matching_feedback",
)
async def confirm_matching_feedback(
    job_id: UUID,
    request: MatchFeedbackRequest,
    service: Annotated[MatchingFeedbackService, Depends(get_feedback_service)],
    memory: Annotated[MatchingMemoryRepository, Depends(get_matching_memory)],
) -> MatchFeedback:
    return await service.confirm(job_id, request, memory)
