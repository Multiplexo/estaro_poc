"""Async extraction job queries and lifecycle updates."""

from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.api.extractions import ExtractionRequest
from app.models.domain.inquiries import FileType, InquiryExtractionSnapshot
from app.models.jobs.extraction import (
    INQUIRY_EXTRACTION_SCHEMA_VERSION,
    ExtractedField,
    ExtractionStatus,
    InquiryExtraction,
)
from app.persistence.domain.inquiries.schema.inquiry import Inquiry, InquiryDocument
from app.persistence.domain.inquiries.schema.inquiry_extraction import (
    InquiryExtraction as ExtractionSchema,
)
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob

logger = structlog.get_logger(__name__)


class ExtractionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, request: ExtractionRequest) -> ExtractionJob:
        try:
            inquiry = Inquiry(created_at=datetime.now(UTC))
            self.session.add(inquiry)
            await self.session.flush()
            document = InquiryDocument(
                id=request.document_id,
                inquiry_id=inquiry.id,
                filename=request.filename,
                source_key=request.source_key,
                file_type=FileType.PDF,
            )
            self.session.add(document)
            await self.session.flush()
            job = ExtractionJob(
                source_key=request.source_key,
                inquiry_id=inquiry.id,
                document_id=document.id,
            )
            await self.save(job)
            return job
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("extraction_job_create_failed")
            raise

    async def get_result(self, job_id: UUID) -> InquiryExtractionSnapshot | None:
        try:
            statement = select(ExtractionSchema).where(
                ExtractionSchema.job_id == job_id
            )
            record = (await self.session.exec(statement)).one_or_none()
            return record.to_model() if record is not None else None
        except SQLAlchemyError:
            logger.exception("extraction_result_get_failed", job_id=str(job_id))
            raise

    async def complete(
        self,
        job: ExtractionJob,
        result: InquiryExtraction,
        model: str,
        prompt_version: str,
    ) -> None:
        if job.status != ExtractionStatus.RUNNING:
            raise ValueError("Only running extraction jobs can be completed")
        if job.inquiry_id is None or job.document_id is None:
            raise ValueError("Extraction job must reference an inquiry and document")

        job_id = job.id
        try:
            document = await self.session.get(InquiryDocument, job.document_id)
            if document is None or document.inquiry_id != job.inquiry_id:
                raise ValueError("Extraction document must belong to the inquiry")
            for record in [result, *result.items]:
                for name in type(record).model_fields:
                    field = getattr(record, name)
                    if not isinstance(field, ExtractedField):
                        continue
                    for citation in field.citations:
                        if citation.document_id != str(document.id):
                            raise ValueError(
                                "Citation must reference the extraction document"
                            )
                        if (
                            citation.bbox is None
                            or citation.page_number is None
                            or citation.page_width is None
                            or citation.page_height is None
                        ):
                            raise ValueError(
                                "Citation must have grounded page coordinates"
                            )

            snapshot = ExtractionSchema(
                inquiry_id=job.inquiry_id,
                job_id=job_id,
                schema_version=INQUIRY_EXTRACTION_SCHEMA_VERSION,
                model=model,
                prompt_version=prompt_version,
                result=result.model_dump(mode="json"),
            )
            self.session.add(snapshot)
            job.status = ExtractionStatus.SUCCEEDED
            job.current_step = None
            job.finished_at = datetime.now(UTC)
            await self.save(job)
        except (SQLAlchemyError, ValueError):
            await self.session.rollback()
            logger.exception("extraction_result_save_failed", job_id=str(job_id))
            raise

    async def get(self, job_id: UUID) -> ExtractionJob | None:
        try:
            return await self.session.get(ExtractionJob, job_id)
        except SQLAlchemyError:
            logger.exception("extraction_job_get_failed", job_id=str(job_id))
            raise

    async def claim(self, job_id: UUID) -> ExtractionJob | None:
        """Only one delivery may move a queued job into running state."""
        try:
            statement = (
                select(ExtractionJob)
                .where(
                    ExtractionJob.id == job_id,
                    ExtractionJob.status == ExtractionStatus.QUEUED,
                )
                .with_for_update(skip_locked=True)
            )
            job = (await self.session.exec(statement)).one_or_none()
            if job is None:
                await self.session.rollback()
                return None
            job.status = ExtractionStatus.RUNNING
            job.started_at = datetime.now(UTC)
            await self.save(job)
            return job
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("extraction_job_claim_failed", job_id=str(job_id))
            raise

    async def fail_queued(self, job_id: UUID) -> None:
        """Do not overwrite worker progress after an ambiguous publish failure."""
        try:
            statement = (
                select(ExtractionJob)
                .where(
                    ExtractionJob.id == job_id,
                    ExtractionJob.status == ExtractionStatus.QUEUED,
                )
                .with_for_update()
            )
            job = (await self.session.exec(statement)).one_or_none()
            if job is None:
                await self.session.rollback()
                return
            job.status = ExtractionStatus.FAILED
            job.error = "Queue submission failed"
            job.finished_at = datetime.now(UTC)
            await self.save(job)
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception(
                "extraction_job_enqueue_failure_save_failed", job_id=str(job_id)
            )
            raise

    async def save(self, job: ExtractionJob) -> None:
        job_id = job.id
        try:
            self.session.add(job)
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("extraction_job_save_failed", job_id=str(job_id))
            raise
