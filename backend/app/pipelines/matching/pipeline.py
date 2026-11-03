import asyncio

import structlog

from app.models.domain.inquiry_data import InquiryPosition
from app.models.jobs.matching import (
    ArticleMatchResult,
    MatchingJobStatus,
    MatchingResult,
    MatchResult,
)
from app.pipelines.matching.agents import MatchingAgents

logger = structlog.get_logger(__name__)


async def run_matching_pipeline(
    job: MatchingJobStatus, agents: MatchingAgents, concurrency: int
) -> MatchingResult:
    if concurrency < 1:
        raise ValueError("Matching concurrency must be positive")
    semaphore = asyncio.Semaphore(concurrency)

    async def match_customer() -> MatchResult:
        result = await agents.customer(job.input_data)
        result.conflicts = list(
            dict.fromkeys(
                result.conflicts
                + [
                    name
                    for name in job.source_conflicts
                    if name.startswith(("customer", "contact"))
                ]
            )
        )
        return result

    async def match_position(
        index: int, position: InquiryPosition
    ) -> ArticleMatchResult:
        async with semaphore:
            try:
                result = await agents.article(position, job.input_data.kopftext)
            except Exception:
                logger.exception(
                    "article_matching_failed", job_id=str(job.id), position_index=index
                )
                raise
            result.conflicts = list(
                dict.fromkeys(
                    result.conflicts
                    + [
                        name
                        for name in job.source_conflicts
                        if name == "requirements" or name.startswith(f"item-{index}-")
                    ]
                )
            )
            return ArticleMatchResult(position_index=index, **result.model_dump())

    try:
        async with asyncio.TaskGroup() as group:
            customer_task = group.create_task(match_customer())
            article_tasks = [
                group.create_task(match_position(index, position))
                for index, position in enumerate(job.input_data.positionen or [])
            ]
        customer = customer_task.result()
        articles = [task.result() for task in article_tasks]
    except Exception:
        logger.exception("matching_pipeline_failed", job_id=str(job.id))
        raise
    logger.info(
        "matching_pipeline_completed", job_id=str(job.id), position_count=len(articles)
    )
    return MatchingResult(customer=customer, articles=articles)
