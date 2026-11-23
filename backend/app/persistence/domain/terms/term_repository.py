import structlog
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.terms import ArticleTerm as ArticleTermModel
from app.persistence.domain.terms.schema.term import ArticleTerm

logger = structlog.get_logger(__name__)


class TermRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_terms(self) -> list[ArticleTermModel]:
        try:
            rows = (await self.session.exec(select(ArticleTerm))).all()
        except SQLAlchemyError:
            logger.exception("article_terms_lookup_failed")
            raise
        return [row.to_model() for row in rows]

    async def replace_all(self, terms: list[ArticleTermModel]) -> None:
        """Replace the whole list; the Excel file is the single source of truth."""
        try:
            await self.session.execute(delete(ArticleTerm))
            self.session.add_all(
                ArticleTerm(**term.model_dump(mode="json")) for term in terms
            )
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("article_terms_replace_failed")
            raise
