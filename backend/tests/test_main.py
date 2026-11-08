import pytest
from httpx import AsyncClient
from psycopg import OperationalError
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import get_article_repository
from app.persistence.domain.articles.article_repository import ArticleRepository
from tests.types import OverrideDependency


async def test_root(client: AsyncClient) -> None:
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello World"}


@pytest.mark.parametrize(
    "error",
    [
        SQLAlchemyError("private database detail"),
        OperationalError("private database detail"),
        OSError("private database detail"),
    ],
)
async def test_database_error_is_sanitized(
    client: AsyncClient,
    override_dependency: OverrideDependency,
    error: Exception,
) -> None:
    repository = override_dependency(get_article_repository, ArticleRepository)
    repository.list_articles.side_effect = error
    response = await client.get("/articles")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
