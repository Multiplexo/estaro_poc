from langchain.tools import tool
from langchain_core.tools import BaseTool
from pydantic import PositiveInt, TypeAdapter
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.articles import Article, ArticleSearchFilters
from app.models.jobs.matching import MatchFeedback
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.jobs.matching.memory_repository import MatchingMemoryRepository


def create_position_tools(
    sessions: async_sessionmaker[AsyncSession],
    memory: MatchingMemoryRepository,
    candidates: dict[str, Article],
) -> list[BaseTool]:
    @tool
    async def search_articles(query: str, filters: ArticleSearchFilters) -> str:
        """Suche Artikel über Nummer, Matchcode oder Beschreibung mit optionalen Filtern.

        filters darf leer sein. Unterstützt werden article_number, variant,
        matchcode, description_1, description_2, article_group_code, manufacturer,
        sales_unit_code, is_active, is_saleable und stock_quantity_min.
        Matchcode und Beschreibungen werden als Teiltext gesucht; andere Textfilter
        müssen exakt übereinstimmen. Boolesche Filter benötigen true oder false.
        Ohne Filter werden keine Artikel aufgrund fachlicher Regeln ausgeschlossen.
        Werkstoffe und Maße können als Suchtext oder Beschreibung gefiltert werden.
        """
        async with sessions() as session:
            records = await ArticleRepository(session).search(query, filters=filters)
        candidates.update({str(record.id): record for record in records})
        return TypeAdapter(list[Article]).dump_json(records).decode()

    @tool
    async def get_article_details(article_id: PositiveInt) -> str:
        """Lies die vollständigen Artikelstammdaten zu einer exakten Artikel-Datenbank-ID."""
        async with sessions() as session:
            record = await ArticleRepository(session).get_article(article_id)
        if record is None:
            return "null"
        candidates[str(record.id)] = record
        return record.model_dump_json()

    @tool
    async def get_position_feedback(query: str) -> str:
        """Suche bestätigtes, wiederverwendbares Positionsfeedback anhand von Suchbegriffen oder früheren Zuordnungen."""
        records = await memory.search("article", query)
        return TypeAdapter(list[MatchFeedback]).dump_json(records).decode()

    return [search_articles, get_article_details, get_position_feedback]
