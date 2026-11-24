from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.config import SettingsDep
from app.dependencies import SessionDep, get_inquiry_repository
from app.models.domain.pilot_metrics import PilotMetrics
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.usage.usage_repository import UsageRepository
from app.services.domain.pilot_metrics import (
    compute_cost_metrics,
    compute_pilot_metrics,
)

router = APIRouter()
RepositoryDep = Annotated[InquiryRepository, Depends(get_inquiry_repository)]


@router.get("/pilot", operation_id="get_pilot_metrics")
async def get_pilot_metrics(
    repository: RepositoryDep,
    session: SessionDep,
    settings: SettingsDep,
    response: Response,
) -> PilotMetrics:
    """Key figures of the pilot from all completed reviews, plus AI costs."""
    response.headers["Cache-Control"] = "no-store"
    metrics = compute_pilot_metrics(await repository.list_reviewed())
    prices = (
        (
            settings.LLM_PRICE_INPUT_EUR_PER_MILLION,
            settings.LLM_PRICE_OUTPUT_EUR_PER_MILLION,
        )
        if settings.LLM_PRICE_INPUT_EUR_PER_MILLION is not None
        and settings.LLM_PRICE_OUTPUT_EUR_PER_MILLION is not None
        else None
    )
    metrics.costs = compute_cost_metrics(
        await UsageRepository(session).list_all(), prices
    )
    return metrics
