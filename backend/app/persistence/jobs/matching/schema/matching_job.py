from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.jobs.extraction import ExtractionStatus
from app.models.jobs.matching import MatchingJobStatus


class MatchingJob(SQLModel, table=True):
    __tablename__ = "matching_job"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    extraction_job_id: UUID = Field(
        foreign_key="extraction_job.id", ondelete="CASCADE", unique=True
    )
    inquiry_id: UUID = Field(foreign_key="inquiry.id", ondelete="CASCADE", index=True)
    status: ExtractionStatus = Field(
        default=ExtractionStatus.QUEUED,
        sa_type=Enum(
            ExtractionStatus,
            name="matching_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda statuses: [status.value for status in statuses],
        ),
    )
    input_revision: int = Field(default=0)
    input_data: dict[str, Any] = Field(sa_type=JSONB)
    source_conflicts: list[str] = Field(default_factory=list, sa_type=JSONB)
    result: dict[str, Any] | None = Field(default=None, sa_type=JSONB)
    error: str | None = Field(default=None, sa_type=Text)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    started_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    finished_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    def to_model(self) -> MatchingJobStatus:
        return MatchingJobStatus.model_validate(self)
