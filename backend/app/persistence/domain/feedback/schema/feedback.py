from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.domain.feedback import Feedback as FeedbackModel
from app.models.domain.feedback import FeedbackKind


class Feedback(SQLModel, table=True):
    __tablename__ = "feedback"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),
        index=True,
    )
    user_id: str = Field(sa_type=Text)
    user_name: str = Field(sa_type=Text)
    kind: str = Field(sa_type=Text)
    message: str = Field(sa_type=Text)
    inquiry_id: UUID | None = Field(
        default=None, foreign_key="inquiry.id", ondelete="SET NULL"
    )
    target: str | None = Field(default=None, sa_type=Text)
    page: str | None = Field(default=None, sa_type=Text)
    context: dict[str, Any] = Field(default_factory=dict, sa_type=JSONB)
    forwarded_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    def to_model(self) -> FeedbackModel:
        return FeedbackModel(
            id=self.id,
            created_at=self.created_at,
            user_id=self.user_id,
            user_name=self.user_name,
            kind=FeedbackKind(self.kind),
            message=self.message,
            inquiry_id=self.inquiry_id,
            target=self.target,
            page=self.page,
            context=dict(self.context),
            forwarded_at=self.forwarded_at,
        )
