import json

from langchain.tools import tool
from langchain_core.tools import BaseTool
from pydantic import PositiveInt, TypeAdapter
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.articles import Article, ArticleSearchFilters
from app.models.domain.terms import ArticleTerm, TermMatch
from app.models.jobs.matching import MatchFeedback
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.terms.term_repository import TermRepository
from app.persistence.jobs.matching.memory_repository import MatchingMemoryRepository
from app.services.domain.terms import resolve_terms as find_terms

ARTICLE_SEARCH_FIELDS = {
    "id",
    "article_number",
    "variant",
    "matchcode",
    "description_1",
    "description_2",
    "article_group_name",
    "sales_unit_code",
    "stock_quantity",
}


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
        Es werden ausschließlich aktive Artikel zurückgegeben, unabhängig von filters.
        Werkstoffe und Maße können als Suchtext oder Beschreibung gefiltert werden.
        Liefert Kurzdaten je Treffer; alle Felder mit get_article_details.
        """
        async with sessions() as session:
            records = await ArticleRepository(session).search(
                query, filters=filters.model_copy(update={"is_active": True})
            )
        candidates.update({str(record.id): record for record in records})
        # Compact rows keep token use low; get_article_details returns all fields.
        return json.dumps(
            [
                record.model_dump(mode="json", include=ARTICLE_SEARCH_FIELDS)
                for record in records
            ],
            ensure_ascii=False,
        )

    @tool
    async def get_article_details(article_id: PositiveInt) -> str:
        """Lies die vollständigen Stammdaten eines aktiven Artikels anhand seiner Datenbank-ID."""
        async with sessions() as session:
            record = await ArticleRepository(session).get_article(article_id)
        if record is None or not record.is_active:
            return "null"
        candidates[str(record.id)] = record
        return record.model_dump_json()

    @tool
    async def get_position_feedback(query: str) -> str:
        """Suche bestätigtes, wiederverwendbares Positionsfeedback anhand von Suchbegriffen oder früheren Zuordnungen."""
        records = await memory.search("article", query)
        return TypeAdapter(list[MatchFeedback]).dump_json(records).decode()

    loaded_terms: list[ArticleTerm] | None = None

    @tool
    async def resolve_terms(text: str) -> str:
        """Gleiche Positionstext mit der estaro-Bezeichnungsliste ab.

        Liefert erkannte Artikelarten mit Matchcode-Muster, Werkstoffe als
        vierstellige Matchcode-Nummer (ggf. mit substitute_for) und Zubehör mit
        Artikelnummer. Übergib Bezeichnung, Werkstoff, Abmessung und Anforderungen.
        """
        nonlocal loaded_terms
        if loaded_terms is None:
            async with sessions() as session:
                loaded_terms = await TermRepository(session).list_terms()
        matches = find_terms(loaded_terms, text)
        return TypeAdapter(list[TermMatch]).dump_json(matches).decode()

    return [search_articles, get_article_details, get_position_feedback, resolve_terms]
