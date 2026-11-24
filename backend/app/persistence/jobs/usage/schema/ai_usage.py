from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Text
from sqlmodel import Field, SQLModel


class AIUsage(SQLModel, table=True):
    """Token usage of one AI run (extraction or matching), also for failed runs."""

    __tablename__ = "ai_usage"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),
        index=True,
    )
    job_kind: str = Field(sa_type=Text)
    job_id: UUID
    inquiry_id: UUID | None = Field(
        default=None, foreign_key="inquiry.id", ondelete="SET NULL", index=True
    )
    model: str = Field(sa_type=Text)
    input_tokens: int = 0
    output_tokens: int = 0
    succeeded: bool = True
