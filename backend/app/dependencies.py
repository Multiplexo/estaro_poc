"""Request-scoped repositories and extraction dependencies."""

from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.services.jobs.extractions import ExtractionService
from app.services.shared.database import get_session

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_extraction_service(session: SessionDep) -> ExtractionService:
    """Inject extraction job persistence and queue submission."""
    return ExtractionService(ExtractionRepository(session))


async def get_article_repository(session: SessionDep) -> ArticleRepository:
    """Inject article queries with the request session."""
    return ArticleRepository(session)


async def get_customer_repository(session: SessionDep) -> CustomerRepository:
    """Inject customer queries with the request session."""
    return CustomerRepository(session)


async def get_inquiry_repository(session: SessionDep) -> InquiryRepository:
    """Inject inquiry queries with the request session."""
    return InquiryRepository(session)
