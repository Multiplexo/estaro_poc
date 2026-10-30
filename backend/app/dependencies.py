"""Request-scoped repositories and extraction dependencies."""

from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import SettingsDep
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.services.jobs.extractions import ExtractionService
from app.services.shared.database import get_session
from app.services.shared.minio import MinioService

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_minio_service(settings: SettingsDep) -> MinioService:
    return MinioService(settings)


MinioServiceDep = Annotated[MinioService, Depends(get_minio_service)]


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
