import asyncio
from uuid import UUID

import structlog
from langchain_core.callbacks import get_usage_metadata_callback
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import Settings
from app.models.domain.rules import RuleCategory
from app.persistence.jobs.extractions.memory_repository import ReviewedMemoryRepository
from app.persistence.jobs.matching.memory_repository import matching_memory
from app.persistence.jobs.usage.usage_repository import record_usage
from app.pipelines.extraction.pipeline import run_pipeline
from app.pipelines.extraction.prompts import INQUIRY_EXTRACTION_PROMPT_VERSION
from app.pipelines.matching.agents import MatchingAgents
from app.pipelines.matching.pipeline import run_matching_pipeline
from app.services.domain.rules import RuleService
from app.services.jobs.extractions import ExtractionService
from app.services.jobs.matching import MatchingService
from app.services.shared.ai import AIService, describe_ai_error
from app.services.shared.minio import MinioService

logger = structlog.get_logger(__name__)


class ExtractionExecutionService:
    def __init__(
        self,
        extractions: ExtractionService,
        matching: MatchingService,
        rules: RuleService,
        storage: MinioService,
        settings: Settings,
        memory: ReviewedMemoryRepository,
        usage_sessions: async_sessionmaker[AsyncSession] | None = None,
    ) -> None:
        self.extractions = extractions
        self.matching = matching
        self.rules = rules
        self.storage = storage
        self.settings = settings
        self.memory = memory
        self.usage_sessions = usage_sessions

    async def run(self, job_id: UUID) -> None:
        job = await self.extractions.claim(job_id)
        if job is None:
            logger.info("extraction_job_skipped", job_id=str(job_id))
            return

        async def report_progress(step: str, completed_steps: int) -> None:
            await self.extractions.progress(job_id, step, completed_steps)

        succeeded = False
        with get_usage_metadata_callback() as usage:
            try:
                if (
                    not job.source_key
                    or job.document_id is None
                    or job.inquiry_id is None
                ):
                    raise ValueError(
                        "Extraction job must reference a source and document"
                    )
                prompt = await self.rules.prompt(RuleCategory.EXTRACTION)
                documents = await self.extractions.source_documents(
                    job.inquiry_id, job.document_id
                )
                async with AIService(self.settings) as ai_service:
                    result = await run_pipeline(
                        documents,
                        self.storage,
                        ai_service,
                        report_progress,
                        self.settings.EXTRACTION_CONFIDENCE_THRESHOLD,
                        prompt,
                        self.memory,
                        job.inquiry_id,
                    )
                await self.extractions.complete(
                    job_id,
                    result,
                    self.settings.MODEL,
                    INQUIRY_EXTRACTION_PROMPT_VERSION,
                )
                succeeded = True
            except Exception as error:
                logger.exception("extraction_job_failed", job_id=str(job_id))
                await self.extractions.fail(
                    job_id, error=describe_ai_error(error, self.settings.MODEL)
                )
                raise
            finally:
                if self.usage_sessions is not None:
                    await record_usage(
                        self.usage_sessions,
                        job_kind="extraction",
                        job_id=job_id,
                        inquiry_id=job.inquiry_id,
                        usage=usage.usage_metadata,
                        succeeded=succeeded,
                    )
        logger.info("extraction_job_succeeded", job_id=str(job_id))
        await self.matching.handoff(job_id)


class MatchingExecutionService:
    def __init__(
        self,
        matching: MatchingService,
        rules: RuleService,
        sessions: async_sessionmaker[AsyncSession],
        settings: Settings,
    ) -> None:
        self.matching = matching
        self.rules = rules
        self.sessions = sessions
        self.settings = settings

    async def run(self, job_id: UUID) -> None:
        job = await self.matching.claim(job_id)
        if job is None:
            logger.info("matching_job_skipped", job_id=str(job_id))
            return
        succeeded = False
        with get_usage_metadata_callback() as usage:
            try:
                prompt = await self.rules.prompt(RuleCategory.MATCHING)
                async with (
                    asyncio.timeout(self.settings.MATCHING_TIMEOUT_SECONDS),
                    matching_memory(self.settings, self.sessions) as memory,
                    AIService(self.settings) as ai_service,
                ):
                    agents = MatchingAgents(
                        self.sessions,
                        ai_service,
                        memory,
                        prompt,
                        recursion_limit=self.settings.RECURSION_LIMIT,
                    )
                    result = await run_matching_pipeline(
                        job, agents, self.settings.MATCHING_CONCURRENCY
                    )
                await self.matching.complete(job_id, result)
                succeeded = True
            except Exception as error:
                logger.exception("matching_job_failed", job_id=str(job_id))
                await self.matching.fail(
                    job_id, error=describe_ai_error(error, self.settings.MODEL)
                )
                raise
            finally:
                await record_usage(
                    self.sessions,
                    job_kind="matching",
                    job_id=job_id,
                    inquiry_id=job.inquiry_id,
                    usage=usage.usage_metadata,
                    succeeded=succeeded,
                )
        logger.info("matching_job_succeeded", job_id=str(job_id))
