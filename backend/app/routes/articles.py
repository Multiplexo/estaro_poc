"""GET endpoints for articles."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_article_repository
from app.models.domain.articles import Article
from app.models.shared.pagination import Pagination
from app.persistence.domain.articles.article_repository import ArticleRepository

router = APIRouter()
RepositoryDep = Annotated[ArticleRepository, Depends(get_article_repository)]


@router.get("", response_model=list[Article], operation_id="list_articles")
async def list_articles(
    repository: RepositoryDep,
    pagination: Annotated[Pagination, Depends()],
) -> list[Article]:
    """Return a page of articles."""
    return await repository.list_articles(
        offset=pagination.offset, limit=pagination.limit
    )


@router.get("/{article_id}", response_model=Article, operation_id="get_article_by_id")
async def get_article_by_id(article_id: int, repository: RepositoryDep) -> Article:
    """Return an article by ID."""
    article = await repository.get_article(article_id)
    if article is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found",
        )
    return article
