from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewedField(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    value: str | None = Field(max_length=1000)
    confirmed: bool


class ExtractionReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    revision: int = Field(default=0, ge=0)
    fields: dict[str, ReviewedField] = Field(default_factory=dict)
    updated_at: datetime | None = None


class ExtractionReviewConflict(ValueError):
    pass
