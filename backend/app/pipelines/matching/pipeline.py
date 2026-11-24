import asyncio

import structlog
from langgraph.errors import GraphRecursionError

from app.models.jobs.matching import (
    ArticleMatchResult,
    MatchingJobStatus,
    MatchingResult,
    MatchResult,
)
from app.pipelines.matching.agents import MatchingAgents

logger = structlog.get_logger(__name__)


UNFINISHED_REASON = (
    "Die KI hat innerhalb der erlaubten Arbeitsschritte keine Zuordnung "
    "abgeschlossen. Bitte manuell zuordnen."
)


def unfinished_match() -> MatchResult:
    return MatchResult(
        selected=None,
        confidence=0,
        reason=UNFINISHED_REASON,
        conflicts=["Zuordnung nicht abgeschlossen"],
        requires_review=True,
    )


async def run_matching_pipeline(
    job: MatchingJobStatus, agents: MatchingAgents, concurrency: int
) -> MatchingResult:
    if concurrency < 1:
        raise ValueError("Matching concurrency must be positive")
    semaphore = asyncio.Semaphore(concurrency)

    async def match_customer() -> MatchResult:
        try:
            result = await agents.customer(job.input_data)
        except GraphRecursionError:
            logger.warning("customer_matching_unfinished", job_id=str(job.id))
            result = unfinished_match()
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

    async def match_position(index: int) -> ArticleMatchResult:
        async with semaphore:
            try:
                result = await agents.article(job.input_data, index)
            except GraphRecursionError:
                # One position the agent could not settle must not fail the inquiry.
                logger.warning(
                    "article_matching_unfinished",
                    job_id=str(job.id),
                    position_index=index,
                )
                result = unfinished_match()
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
                group.create_task(match_position(index))
                for index in range(len(job.input_data.positionen or []))
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
