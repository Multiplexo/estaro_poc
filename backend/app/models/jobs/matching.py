from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.domain.inquiry_data import InquiryData, InquiryPosition
from app.models.jobs.extraction import ExtractionStatus

MatchCategory = Literal["customer", "article"]


class MatchingQueueUnavailable(RuntimeError):
    pass


class ArticleMatchingInput(BaseModel):
    position: InquiryPosition
    kopftext: str | None = None


def matching_input(
    data: InquiryData, category: MatchCategory, position_index: int | None = None
) -> str:
    if category == "customer":
        source = data.kundeninformationen
        return source.model_dump_json(exclude_none=True) if source else "{}"
    if (
        position_index is None
        or position_index < 0
        or not data.positionen
        or position_index >= len(data.positionen)
    ):
        raise ValueError("A valid position index is required for article feedback")
    position = data.positionen[position_index]
    if not position.model_dump(exclude_none=True):
        return "{}"
    return ArticleMatchingInput(
        position=position, kopftext=data.kopftext
    ).model_dump_json(exclude_none=True)


class MatchDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entity_id: str | None = None
    alternative_ids: list[str] = Field(default_factory=list, max_length=5)
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(min_length=1, max_length=600)
    conflicts: list[str] = Field(default_factory=list, max_length=20)


class MatchCandidate(BaseModel):
    entity_id: str
    number: str
    label: str | None = None
    variant: str | None = None
    reason: str | None = None
    conflicts: list[str] = Field(default_factory=list)


class MatchResult(BaseModel):
    selected: MatchCandidate | None = None
    alternatives: list[MatchCandidate] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    reason: str
    conflicts: list[str] = Field(default_factory=list)
    requires_review: bool = True


class ArticleMatchResult(MatchResult):
    position_index: int = Field(ge=0)


class MatchingResult(BaseModel):
    customer: MatchResult
    articles: list[ArticleMatchResult]


class MatchingJobStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    extraction_job_id: UUID
    inquiry_id: UUID
    status: ExtractionStatus
    input_revision: int
    input_data: InquiryData
    source_conflicts: list[str]
    result: MatchingResult | None
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class MatchTargetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: MatchCategory
    position_index: int | None = Field(default=None, ge=0)
    entity_id: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validate_target(self) -> Self:
        if self.category == "customer":
            if self.position_index is not None:
                raise ValueError("Customer matching must not specify a position")
            self.entity_id = str(UUID(self.entity_id))
            return self
        if self.position_index is None:
            raise ValueError("Article matching requires a position")
        article_id = int(self.entity_id)
        if article_id <= 0:
            raise ValueError("Article ID must be positive")
        self.entity_id = str(article_id)
        return self


class MatchFeedbackRequest(MatchTargetRequest):
    note: str = Field(default="", max_length=2000)
    reuse_for_matching: bool = False


class MatchSelectionRequest(MatchTargetRequest):
    revision: int = Field(ge=0)


class MatchFeedback(BaseModel):
    id: UUID
    job_id: UUID
    category: MatchCategory
    position_index: int | None
    input_key: str
    source_input: str
    entity_id: str
    proposed_entity_id: str | None
    note: str
    reuse_for_matching: bool
    created_at: datetime
