from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.dependencies import get_inquiry_repository
from app.models.domain.pilot_metrics import PilotMetrics
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.services.domain.pilot_metrics import compute_pilot_metrics

router = APIRouter()
RepositoryDep = Annotated[InquiryRepository, Depends(get_inquiry_repository)]


@router.get("/pilot", operation_id="get_pilot_metrics")
async def get_pilot_metrics(
    repository: RepositoryDep, response: Response
) -> PilotMetrics:
    """Key figures of the pilot from all completed reviews."""
    response.headers["Cache-Control"] = "no-store"
    return compute_pilot_metrics(await repository.list_reviewed())
