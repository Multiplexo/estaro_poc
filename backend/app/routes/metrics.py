from functools import partial
from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.config import Settings, SettingsDep
from app.dependencies import SessionDep, get_inquiry_repository
from app.models.domain.pilot_metrics import PilotMetrics
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.usage.usage_repository import UsageRepository
from app.services.domain.pilot_metrics import (
    compute_cost_metrics,
    compute_pilot_metrics,
)

router = APIRouter()


def _pair(
    input_price: float | None, output_price: float | None
) -> tuple[float, float] | None:
    if input_price is None or output_price is None:
        return None
    return input_price, output_price


def model_prices(settings: Settings, model: str) -> tuple[float, float] | None:
    """Prices per 1M tokens; the provider may report the model with a date suffix."""
    guardrail = settings.GUARDRAIL_MODEL
    if guardrail and guardrail != settings.MODEL and model.startswith(guardrail):
        return _pair(
            settings.GUARDRAIL_PRICE_INPUT_EUR_PER_MILLION,
            settings.GUARDRAIL_PRICE_OUTPUT_EUR_PER_MILLION,
        )
    return _pair(
        settings.LLM_PRICE_INPUT_EUR_PER_MILLION,
        settings.LLM_PRICE_OUTPUT_EUR_PER_MILLION,
    )


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
    metrics.costs = compute_cost_metrics(
        await UsageRepository(session).list_all(), partial(model_prices, settings)
    )
    return metrics
