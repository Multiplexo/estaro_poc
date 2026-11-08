from decimal import Decimal

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence import Article
from app.persistence.domain.articles.article_repository import ArticleRepository

pytestmark = pytest.mark.integration


async def test_articles_lookup_variant_and_pagination(db_session: AsyncSession) -> None:
    records = [
        Article(
            id=index,
            article_number="A-100",
            variant=variant,
            stock_quantity=Decimal("12.5"),
            weight_kg=Decimal("1.25"),
            is_active=True,
            has_memo=False,
            is_saleable=True,
            is_purchasable=True,
        )
        for index, variant in [(2, "blue"), (1, "")]
    ]
    db_session.add_all(records)
    await db_session.flush()
    repository = ArticleRepository(db_session)

    article = await repository.get_article(1)
    assert article is not None
    assert article.stock_quantity == Decimal("12.5")
    assert await repository.get_article(999) is None
    assert await repository.get_article_by_number("A-100") == article
    variant = await repository.get_article_by_number("A-100", "blue")
    assert variant is not None and variant.id == 2
    assert await repository.get_article_by_number("missing") is None
    assert [item.id for item in await repository.list_articles(offset=1, limit=1)] == [
        2
    ]
    assert await repository.list_articles(offset=2) == []


@pytest.mark.parametrize("offset,limit", [(-1, 1), (0, 0)])
async def test_rejects_invalid_pagination(
    db_session: AsyncSession, offset: int, limit: int
) -> None:
    repository = ArticleRepository(db_session)
    with pytest.raises(ValueError, match="offset must be non-negative"):
        await repository.list_articles(offset=offset, limit=limit)
