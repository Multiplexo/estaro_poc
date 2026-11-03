"""Async article queries and schema-to-model mapping."""

from sqlalchemy import func, or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.articles import Article, ArticleSearchFilters
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

    async def search(
        self,
        query: str,
        limit: int = 15,
        *,
        filters: ArticleSearchFilters | None = None,
    ) -> list[Article]:
        query = query.strip()[:200]
        values = (filters or ArticleSearchFilters()).model_dump(exclude_none=True)
        if not query and not values:
            return []
        text = func.concat_ws(
            " ",
            ArticleSchema.article_number,
            ArticleSchema.matchcode,
            ArticleSchema.description_1,
            ArticleSchema.description_2,
        )
        score = func.word_similarity(query, text)
        statement = select(ArticleSchema)
        if query:
            statement = statement.where(
                or_(score > 0.15, text.icontains(query, autoescape=True))
            )
        for name, value in values.items():
            if name == "stock_quantity_min":
                statement = statement.where(col(ArticleSchema.stock_quantity) >= value)
            elif name in {"matchcode", "description_1", "description_2"}:
                statement = statement.where(
                    col(getattr(ArticleSchema, name)).icontains(value, autoescape=True)
                )
            else:
                statement = statement.where(col(getattr(ArticleSchema, name)) == value)
        statement = statement.order_by(
            (col(ArticleSchema.article_number) == query).desc(),
            (func.lower(func.trim(ArticleSchema.matchcode)) == query.casefold()).desc(),
            score.desc(),
            col(ArticleSchema.id),
        ).limit(min(max(limit, 1), 30))
        return [
            record.to_model() for record in (await self.session.exec(statement)).all()
        ]
