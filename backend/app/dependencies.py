from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import SettingsDep
from app.models.domain.auth import CurrentUser, UserRole
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.jobs.matching.memory_repository import (
    MatchingMemoryRepository,
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
    create_upload_service,
)
from app.services.jobs.extractions import ExtractionService
from app.services.jobs.matching import MatchingService
from app.services.jobs.matching_feedback import MatchingFeedbackService
from app.services.jobs.uploads import ExtractionUploadService
from app.services.shared.auth import EntraAuthService, read_session
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
    request: Request,
) -> MatchingMemoryRepository:
    return request.app.state.matching_memory


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
    storage: MinioServiceDep,
) -> ExtractionUploadService:
    return create_upload_service(session, storage, publish_extraction, publish_matching)


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


SESSION_COOKIE = "estaro_session"
LOCAL_USER = CurrentUser(
    id="local",
    name="Lokale Entwicklung",
    roles=[UserRole.ADMIN, UserRole.USER],
)


async def get_auth_service(settings: SettingsDep) -> AsyncIterator[EntraAuthService]:
    async with httpx.AsyncClient() as client:
        yield EntraAuthService(settings, client)


AuthServiceDep = Annotated[EntraAuthService, Depends(get_auth_service)]


async def get_current_user(
    settings: SettingsDep,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> CurrentUser:
    if not settings.AUTH_ENABLED:
        return LOCAL_USER
    user = read_session(settings, session_token) if session_token else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Nicht angemeldet"
        )
    return user


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


async def require_admin(user: CurrentUserDep) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Diese Aktion ist nur für Administratoren erlaubt",
        )
    return user
