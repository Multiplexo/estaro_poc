"""Async article queries and schema-to-model mapping."""

from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.articles import Article
from app.persistence.domain.articles.schema.article import Article as ArticleSchema


class ArticleRepository:
    """Retrieve articles through an injected async session."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_article(self, article_id: int) -> Article | None:
        """Return a article by ID, or None when absent."""
        record = await self.session.get(ArticleSchema, article_id)
        return record.to_model() if record is not None else None

    async def get_article_by_number(
        self, article_number: str, variant: str = ""
    ) -> Article | None:
        """Return a article matching its business number."""
        statement = select(ArticleSchema).where(
            ArticleSchema.article_number == article_number,
            ArticleSchema.variant == variant,
        )
        record = (await self.session.exec(statement)).one_or_none()
        return record.to_model() if record is not None else None

    async def list_articles(self, offset: int = 0, limit: int = 100) -> list[Article]:
        """Return a consistently ordered page of articles."""
        if offset < 0 or limit < 1:
            raise ValueError("offset must be non-negative and limit must be positive")

        statement = (
            select(ArticleSchema)
            .order_by(col(ArticleSchema.id))
            .offset(offset)
            .limit(limit)
        )
        records = (await self.session.exec(statement)).all()
        return [record.to_model() for record in records]
