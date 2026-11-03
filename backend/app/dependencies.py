from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import SettingsDep
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.matching.memory_repository import (
    MatchingMemoryRepository,
    matching_memory,
)
from app.services.domain.documents import InquiryDocumentService
from app.services.domain.inquiries import InquiryService
from app.services.domain.reviews import ExtractionReviewService
from app.services.domain.rules import RuleService
from app.services.factory import (
    create_extraction_service,
    create_feedback_service,
    create_matching_service,
    create_review_service,
    create_rule_service,
)
from app.services.jobs.extractions import ExtractionService
from app.services.jobs.matching import MatchingService
from app.services.jobs.matching_feedback import MatchingFeedbackService
from app.services.jobs.uploads import ExtractionUploadService
from app.services.shared.database import get_session
from app.services.shared.minio import MinioService
from app.services.shared.transactions import TransactionService
from app.workers.celery_app import publish_extraction, publish_matching

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_minio_service(settings: SettingsDep) -> MinioService:
    return MinioService(settings)


MinioServiceDep = Annotated[MinioService, Depends(get_minio_service)]


async def get_matching_service(session: SessionDep) -> MatchingService:
    return create_matching_service(session, publish_matching)


async def get_feedback_service(session: SessionDep) -> MatchingFeedbackService:
    return create_feedback_service(session)


async def get_matching_memory(
    settings: SettingsDep,
) -> AsyncIterator[MatchingMemoryRepository]:
    async with matching_memory(settings) as memory:
        yield memory


async def get_extraction_service(session: SessionDep) -> ExtractionService:
    return create_extraction_service(session, publish_extraction, publish_matching)


async def get_review_service(session: SessionDep) -> ExtractionReviewService:
    return create_review_service(session)


async def get_inquiry_service(
    session: SessionDep, storage: MinioServiceDep
) -> InquiryService:
    return InquiryService(
        InquiryRepository(session), storage, TransactionService(session)
    )


async def get_upload_service(
    session: SessionDep,
    extractions: Annotated[ExtractionService, Depends(get_extraction_service)],
    cleanup: Annotated[InquiryService, Depends(get_inquiry_service)],
    storage: MinioServiceDep,
) -> ExtractionUploadService:
    return ExtractionUploadService(
        extractions,
        InquiryRepository(session),
        cleanup,
        storage,
        TransactionService(session),
    )


async def get_document_service(
    session: SessionDep, storage: MinioServiceDep
) -> InquiryDocumentService:
    return InquiryDocumentService(InquiryRepository(session), storage)


async def get_rule_service(session: SessionDep) -> RuleService:
    return create_rule_service(session)


async def get_article_repository(session: SessionDep) -> ArticleRepository:
    return ArticleRepository(session)


async def get_customer_repository(session: SessionDep) -> CustomerRepository:
    return CustomerRepository(session)


async def get_inquiry_repository(session: SessionDep) -> InquiryRepository:
    return InquiryRepository(session)
