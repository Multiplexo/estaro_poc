from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.auth import CurrentUser
from app.models.domain.feedback import Feedback as FeedbackModel
from app.models.domain.feedback import FeedbackCreate
from app.persistence.domain.feedback.schema.feedback import Feedback

logger = structlog.get_logger(__name__)


class FeedbackRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, data: FeedbackCreate, user: CurrentUser) -> FeedbackModel:
        record = Feedback(
            user_id=user.id,
            user_name=user.name,
            **data.model_dump(mode="json", exclude={"inquiry_id"}),
            inquiry_id=data.inquiry_id,
        )
        try:
            self.session.add(record)
            await self.session.commit()
            await self.session.refresh(record)
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("feedback_create_failed")
            raise
        return record.to_model()

    async def mark_forwarded(self, feedback_id: UUID) -> FeedbackModel | None:
        try:
            record = await self.session.get(Feedback, feedback_id)
            if record is None:
                return None
            record.forwarded_at = datetime.now(UTC)
            self.session.add(record)
            await self.session.commit()
            await self.session.refresh(record)
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("feedback_mark_forwarded_failed")
            raise
        return record.to_model()

    async def list_recent(self, limit: int = 200) -> list[FeedbackModel]:
        statement = (
            select(Feedback).order_by(col(Feedback.created_at).desc()).limit(limit)
        )
        try:
            return [
                row.to_model() for row in (await self.session.exec(statement)).all()
            ]
        except SQLAlchemyError:
            logger.exception("feedback_list_failed")
            raise
