from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.domain.extraction_review import ExtractionReview
from app.models.domain.inquiry_data import InquiryData
from app.models.jobs.extraction import InquiryExtraction

FieldGroup = Literal["customer", "inquiry", "position"]


class ReviewedInquiry(BaseModel):
    """Latest extraction of an inquiry with its review and the inquiry data."""

    reviewed_at: datetime
    extraction: InquiryExtraction
    review: ExtractionReview
    data: InquiryData


class FieldCorrections(BaseModel):
    group: FieldGroup
    field: str = Field(description="Field ID without position index, e.g. 'quantity'")
    corrections: int
    reviewed: int = Field(description="How often the field was reviewed")


class WeeklyMetrics(BaseModel):
    week: str = Field(description="ISO week, e.g. 2026-W48")
    reviewed_inquiries: int
    without_correction: int
    corrections_per_inquiry: float


class PilotMetrics(BaseModel):
    """Key figures for the pilot, computed from completed reviews."""

    reviewed_inquiries: int = 0
    without_correction: int = Field(
        default=0,
        description="Reviewed inquiries with no field change and no manual matching",
    )
    field_corrections: int = 0
    corrections_per_inquiry: float = 0
    customer_reassigned: int = Field(
        default=0, description="Inquiries where the customer was assigned manually"
    )
    positions: int = 0
    articles_reassigned: int = Field(
        default=0, description="Positions whose article was assigned manually"
    )
    corrections_by_field: list[FieldCorrections] = Field(default_factory=list)
    weekly: list[WeeklyMetrics] = Field(default_factory=list)
