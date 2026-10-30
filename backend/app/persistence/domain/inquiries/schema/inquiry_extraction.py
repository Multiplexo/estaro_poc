"""Immutable extraction snapshots with field-level citations."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.domain.inquiries import InquiryExtractionSnapshot


class InquiryExtraction(SQLModel, table=True):
    __tablename__ = "inquiry_extraction"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        Index("inquiry_extraction_created_at_id_idx", "inquiry_id", "created_at", "id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    inquiry_id: UUID = Field(foreign_key="inquiry.id", ondelete="CASCADE")
    job_id: UUID | None = Field(
        default=None, foreign_key="extraction_job.id", ondelete="SET NULL", unique=True
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    schema_version: int = Field(ge=1)
    model: str = Field(max_length=200)
    prompt_version: str = Field(max_length=100)
    result: dict[str, Any] = Field(sa_type=JSONB)
    review: dict[str, Any] = Field(default_factory=dict, sa_type=JSONB)

    def to_model(self) -> InquiryExtractionSnapshot:
        return InquiryExtractionSnapshot.model_validate(self)
