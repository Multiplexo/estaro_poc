from collections.abc import Awaitable, Callable
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.domain.rules.rule_repository import RuleRepository
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.persistence.jobs.matching.matching_repository import MatchingRepository
from app.services.domain.inquiries import InquiryService
from app.services.domain.reviews import ExtractionReviewService
from app.services.domain.rules import RuleService
from app.services.jobs.extractions import ExtractionService
from app.services.jobs.matching import MatchingService
from app.services.jobs.matching_feedback import MatchingFeedbackService
from app.services.jobs.uploads import ExtractionUploadService
from app.services.shared.minio import MinioService
from app.services.shared.transactions import TransactionService


def create_review_service(session: AsyncSession) -> ExtractionReviewService:
    return ExtractionReviewService(
        InquiryRepository(session),
        ExtractionRepository(session),
        TransactionService(session),
    )


def create_rule_service(session: AsyncSession) -> RuleService:
    return RuleService(
        RuleRepository(session), InquiryRepository(session), TransactionService(session)
    )


def create_matching_service(
    session: AsyncSession, publish: Callable[[UUID], Awaitable[None]]
) -> MatchingService:
    return MatchingService(
        MatchingRepository(session),
        InquiryRepository(session),
        ArticleRepository(session),
        CustomerRepository(session),
        create_review_service(session),
        TransactionService(session),
        publish,
    )


def create_feedback_service(session: AsyncSession) -> MatchingFeedbackService:
    return MatchingFeedbackService(
        MatchingRepository(session),
        ArticleRepository(session),
        CustomerRepository(session),
        create_review_service(session),
        TransactionService(session),
    )


def create_extraction_service(
    session: AsyncSession,
    publish_extraction: Callable[[UUID], Awaitable[None]],
    publish_matching: Callable[[UUID], Awaitable[None]],
) -> ExtractionService:
    return ExtractionService(
        ExtractionRepository(session),
        InquiryRepository(session),
        MatchingRepository(session),
        create_matching_service(session, publish_matching),
        TransactionService(session),
        publish_extraction,
    )


def create_upload_service(
    session: AsyncSession,
    storage: MinioService,
    publish_extraction: Callable[[UUID], Awaitable[None]],
    publish_matching: Callable[[UUID], Awaitable[None]],
) -> ExtractionUploadService:
    repository = InquiryRepository(session)
    transactions = TransactionService(session)
    return ExtractionUploadService(
        create_extraction_service(session, publish_extraction, publish_matching),
        repository,
        InquiryService(repository, storage, transactions),
        storage,
        transactions,
    )
