from datetime import UTC, datetime
from uuid import UUID, uuid4

import structlog
from fastapi import HTTPException

from app.models.jobs.extraction import ExtractionStatus
from app.models.jobs.matching import MatchFeedback, MatchFeedbackRequest, matching_input
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.domain.customers.customer_repository import CustomerRepository
from app.persistence.jobs.matching.matching_repository import MatchingRepository
from app.persistence.jobs.matching.memory_repository import (
    MatchingMemoryRepository,
    matching_input_key,
)
from app.services.domain.reviews import ExtractionReviewService
from app.services.shared.transactions import TransactionService

logger = structlog.get_logger(__name__)


class MatchingFeedbackService:
    def __init__(
        self,
        repository: MatchingRepository,
        articles: ArticleRepository,
        customers: CustomerRepository,
        reviews: ExtractionReviewService,
        transactions: TransactionService,
    ) -> None:
        self.repository = repository
        self.articles = articles
        self.customers = customers
        self.reviews = reviews
        self.transactions = transactions

    async def confirm(
        self,
        extraction_job_id: UUID,
        request: MatchFeedbackRequest,
        memory: MatchingMemoryRepository,
    ) -> MatchFeedback:
        async with self.transactions.atomic():
            source = await self.reviews.lock_current(extraction_job_id)
            record = await self.repository.get(extraction_job_id)
            if record is None:
                raise HTTPException(status_code=404, detail="Matching job not found")
            job = record.to_model()
            if job.status != ExtractionStatus.SUCCEEDED or job.result is None:
                raise HTTPException(
                    status_code=409,
                    detail="Matching must finish before feedback can be confirmed",
                )
            if source.review.revision != job.input_revision:
                raise HTTPException(
                    status_code=409,
                    detail="Extraction was edited; rerun matching before confirming feedback",
                )
            try:
                source_input = matching_input(
                    job.input_data, request.category, request.position_index
                )
                if source_input == "{}":
                    raise ValueError("Cannot confirm feedback for empty input")
                if request.category == "customer":
                    customer = await self.customers.get_customer(
                        UUID(request.entity_id)
                    )
                    if customer is None:
                        raise ValueError("Customer not found")
                    entity_id = str(customer.id)
                    proposal = job.result.customer.selected
                else:
                    article = await self.articles.get_article(int(request.entity_id))
                    if article is None:
                        raise ValueError("Article not found")
                    entity_id = str(article.id)
                    proposal = next(
                        item.selected
                        for item in job.result.articles
                        if item.position_index == request.position_index
                    )
            except (ValueError, StopIteration) as exc:
                raise HTTPException(
                    status_code=422, detail=str(exc) or "Invalid feedback position"
                ) from exc
            feedback = MatchFeedback(
                id=uuid4(),
                job_id=job.id,
                category=request.category,
                position_index=request.position_index,
                input_key=matching_input_key(source_input),
                source_input=source_input,
                entity_id=entity_id,
                proposed_entity_id=proposal.entity_id if proposal else None,
                note=request.note,
                reuse_for_matching=request.reuse_for_matching,
                created_at=datetime.now(UTC),
            )
            await memory.record(feedback)
        logger.info(
            "matching_feedback_confirmed",
            job_id=str(job.id),
            category=request.category,
            reusable=request.reuse_for_matching,
        )
        return feedback
