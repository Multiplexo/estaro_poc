"""Durable extraction job status, separate from the Celery result backend."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Enum, Text
from sqlmodel import Field, SQLModel

from app.models.jobs.extraction import ExtractionJobStatus, ExtractionStatus


class ExtractionJob(SQLModel, table=True):
    __tablename__ = "extraction_job"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        CheckConstraint(
            "completed_steps BETWEEN 0 AND 4", name="extraction_job_progress_check"
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    source_key: str | None = Field(default=None, max_length=1024)
    status: ExtractionStatus = Field(
        default=ExtractionStatus.QUEUED,
        sa_type=Enum(
            ExtractionStatus,
            name="extraction_status",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda statuses: [status.value for status in statuses],
        ),
    )
    current_step: str | None = Field(default=None, max_length=32)
    completed_steps: int = Field(default=0)
    error: str | None = Field(default=None, sa_type=Text)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    started_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    finished_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    def to_model(self) -> ExtractionJobStatus:
        return ExtractionJobStatus.model_validate(self)
