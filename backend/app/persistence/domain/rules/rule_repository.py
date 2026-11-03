from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.rules import Rule, RuleCategory, RuleCreate, RuleUpdate
from app.persistence.domain.rules.schema.rule import Rule as RuleSchema

logger = structlog.get_logger(__name__)


class RuleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_rules(
        self,
        category: RuleCategory | None = None,
        active_only: bool = False,
        document_id: UUID | None = None,
    ) -> list[Rule]:
        statement = select(RuleSchema).order_by(
            col(RuleSchema.created_at), col(RuleSchema.id)
        )
        if category is not None:
            statement = statement.where(RuleSchema.category == category)
        if active_only:
            statement = statement.where(col(RuleSchema.is_active).is_(True))
        if document_id is not None:
            statement = statement.where(RuleSchema.document_id == document_id)
        try:
            return [
                record.to_model()
                for record in (await self.session.exec(statement)).all()
            ]
        except SQLAlchemyError:
            logger.exception("rule_list_failed")
            raise

    async def create(self, data: RuleCreate) -> Rule:
        source = data.source
        record = RuleSchema(
            **data.model_dump(exclude={"source"}),
            inquiry_id=source.inquiry_id if source else None,
            document_id=source.document_id if source else None,
            source_page=source.page if source else None,
            source_quote=source.quote if source else None,
            source_rectangles=[
                rectangle.model_dump() for rectangle in source.rectangles
            ]
            if source
            else [],
        )
        try:
            self.session.add(record)
            await self.session.flush()
            await self.session.refresh(record)
            result = record.to_model()
        except SQLAlchemyError:
            logger.exception("rule_create_failed")
            raise
        return result

    async def update(self, rule_id: UUID, data: RuleUpdate) -> Rule | None:
        try:
            record = await self.session.get(
                RuleSchema, rule_id, with_for_update=True, populate_existing=True
            )
            if record is None:
                return None
            record.sqlmodel_update(data.model_dump())
            record.updated_at = datetime.now(UTC)
            self.session.add(record)
            await self.session.flush()
            await self.session.refresh(record)
            result = record.to_model()
        except SQLAlchemyError:
            logger.exception("rule_update_failed", rule_id=str(rule_id))
            raise
        return result

    async def delete(self, rule_id: UUID) -> bool:
        try:
            record = await self.session.get(
                RuleSchema, rule_id, with_for_update=True, populate_existing=True
            )
            if record is None:
                return False
            await self.session.delete(record)
            await self.session.flush()
        except SQLAlchemyError:
            logger.exception("rule_delete_failed", rule_id=str(rule_id))
            raise
        return True
