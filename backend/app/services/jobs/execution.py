import asyncio
from uuid import UUID

import structlog
from app.config import Settings
from app.models.domain.rules import RuleCategory
from app.persistence.jobs.extractions.memory_repository import ReviewedMemoryRepository
from app.persistence.jobs.matching.memory_repository import matching_memory
from app.pipelines.extraction.pipeline import run_pipeline
from app.pipelines.extraction.prompts import INQUIRY_EXTRACTION_PROMPT_VERSION
from app.pipelines.matching.agents import MatchingAgents
from app.pipelines.matching.pipeline import run_matching_pipeline
from app.services.domain.rules import RuleService
from app.services.jobs.extractions import ExtractionService
from app.services.jobs.matching import MatchingService
from app.services.shared.minio import MinioService
from app.services.shared.openai import OpenAIService
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

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
    ) -> None:
        self.extractions = extractions
        self.matching = matching
        self.rules = rules
        self.storage = storage
        self.settings = settings
        self.memory = memory

    async def run(self, job_id: UUID) -> None:
        job = await self.extractions.claim(job_id)
        if job is None:
            logger.info("extraction_job_skipped", job_id=str(job_id))
            return

        async def report_progress(step: str, completed_steps: int) -> None:
            await self.extractions.progress(job_id, step, completed_steps)

        try:
            if not job.source_key or job.document_id is None or job.inquiry_id is None:
                raise ValueError("Extraction job must reference a source and document")
            prompt = await self.rules.prompt(RuleCategory.EXTRACTION)
            documents = await self.extractions.source_documents(
                job.inquiry_id, job.document_id
            )
            async with OpenAIService(self.settings) as openai:
                result = await run_pipeline(
                    documents,
                    self.storage,
                    openai,
                    report_progress,
                    self.settings.EXTRACTION_CONFIDENCE_THRESHOLD,
                    prompt,
                    self.memory,
                    job.inquiry_id,
                )
            await self.extractions.complete(
                job_id, result, self.settings.MODEL, INQUIRY_EXTRACTION_PROMPT_VERSION
            )
        except Exception:
            logger.exception("extraction_job_failed", job_id=str(job_id))
            await self.extractions.fail(job_id)
            raise
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
        try:
            prompt = await self.rules.prompt(RuleCategory.MATCHING)
            async with (
                asyncio.timeout(self.settings.MATCHING_TIMEOUT_SECONDS),
                matching_memory(self.settings, self.sessions) as memory,
                OpenAIService(self.settings) as openai,
            ):
                agents = MatchingAgents(self.sessions, openai, memory, prompt)
                result = await run_matching_pipeline(
                    job, agents, self.settings.MATCHING_CONCURRENCY
                )
            await self.matching.complete(job_id, result)
        except Exception:
            logger.exception("matching_job_failed", job_id=str(job_id))
            await self.matching.fail(job_id)
            raise
        logger.info("matching_job_succeeded", job_id=str(job_id))
