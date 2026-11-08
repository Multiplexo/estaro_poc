import pytest
from httpx import AsyncClient

from app.dependencies import get_article_repository
from app.models.domain.articles import Article
from app.persistence.domain.articles.article_repository import ArticleRepository
from tests.types import OverrideDependency


async def test_article_response(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    repository = override_dependency(get_article_repository, ArticleRepository)
    article = Article(
        id=1,
        article_number="A-100",
        stock_quantity="12.5",
        weight_kg="1.25",
        is_active=True,
        has_memo=False,
        is_saleable=True,
        is_purchasable=True,
    )
    repository.get_article.return_value = article
    response = await client.get("/articles/1")
    assert response.status_code == 200
    assert response.json() == article.model_dump(mode="json")
    repository.get_article.assert_awaited_once_with(1)


async def test_list_pagination(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    repository = override_dependency(get_article_repository, ArticleRepository)
    repository.list_articles.return_value = []
    response = await client.get("/articles", params={"offset": 2, "limit": 5})
    assert response.status_code == 200
    assert response.json() == []
    repository.list_articles.assert_awaited_once_with(offset=2, limit=5)


@pytest.mark.parametrize("query", ["offset=-1", "limit=0", "limit=1001"])
async def test_list_rejects_invalid_pagination(
    client: AsyncClient, override_dependency: OverrideDependency, query: str
) -> None:
    repository = override_dependency(get_article_repository, ArticleRepository)
    response = await client.get(f"/articles?{query}")
    assert response.status_code == 422
    repository.list_articles.assert_not_awaited()


async def test_missing_article(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    repository = override_dependency(get_article_repository, ArticleRepository)
    repository.get_article.return_value = None
    response = await client.get("/articles/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Article not found"}
