from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class FeedbackKind(StrEnum):
    BUG = "bug"
    CHANGE = "change"
    DOMAIN = "domain"


class FeedbackCreate(BaseModel):
    kind: FeedbackKind
    message: str = Field(min_length=3, max_length=4000)
    inquiry_id: UUID | None = None
    target: str | None = Field(
        default=None,
        max_length=200,
        description="Field or position the feedback refers to, e.g. 'positionen.0'",
    )
    page: str | None = Field(default=None, max_length=500)
    context: dict[str, Any] = Field(default_factory=dict)


class Feedback(FeedbackCreate):
    id: UUID
    created_at: datetime
    user_id: str
    user_name: str
    forwarded_at: datetime | None = None
