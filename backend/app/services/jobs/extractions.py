from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from uuid import UUID

import structlog
from fastapi import HTTPException

from app.models.api.extractions import ExtractionRequest
from app.models.domain.inquiries import (
    FileType,
)
from app.models.domain.inquiries import (
    InquiryDocument as InquiryDocumentModel,
)
from app.models.domain.inquiry_data import InquiryData
from app.models.domain.inquiry_mapping import map_extraction_to_inquiry
from app.models.jobs.extraction import (
    ACTIVE_JOB_STATUSES,
    INQUIRY_EXTRACTION_SCHEMA_VERSION,
    ExtractionJobStatus,
    ExtractionQueueUnavailable,
    ExtractionStatus,
    InquiryExtraction,
    extraction_fields,
)
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.domain.inquiries.schema.inquiry import Inquiry, InquiryDocument
from app.persistence.domain.inquiries.schema.inquiry_extraction import (
    InquiryExtraction as ExtractionSnapshot,
)
from app.persistence.jobs.extractions.extraction_repository import ExtractionRepository
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob
from app.persistence.jobs.matching.matching_repository import MatchingRepository
from app.services.jobs.matching import MatchingService
from app.services.shared.transactions import TransactionService

logger = structlog.get_logger(__name__)


def validate_citations(
    result: InquiryExtraction, documents: list[InquiryDocumentModel]
) -> None:
    by_id = {str(document.id): document for document in documents}
    for _, field in extraction_fields(result):
        for citation in field.citations:
            document = by_id.get(citation.document_id)
            if document is None:
                raise ValueError(
                    "Citation must reference an extraction source document"
                )
            if document.file_type.is_email:
                if any(
                    value is not None
                    for value in (
                        citation.bbox,
                        citation.page_number,
                        citation.page_width,
                        citation.page_height,
                    )
                ):
                    raise ValueError("Email citations must not have page coordinates")
            elif (
                citation.bbox is None
                or citation.page_number is None
                or citation.page_width is None
                or citation.page_height is None
            ):
                raise ValueError("Citation must have grounded page coordinates")


class ExtractionService:
    def __init__(
        self,
        repository: ExtractionRepository,
        inquiries: InquiryRepository,
        matching_repository: MatchingRepository,
        matching: MatchingService,
        transactions: TransactionService,
        publish: Callable[[UUID], Awaitable[None]],
    ) -> None:
        self.repository = repository
        self.inquiries = inquiries
        self.matching_repository = matching_repository
        self.matching = matching
        self.transactions = transactions
        self._publish = publish

    async def register_upload(self, request: ExtractionRequest) -> InquiryDocumentModel:
        async with self.transactions.atomic():
            inquiry = Inquiry(created_at=datetime.now(UTC))
            await self.inquiries.save(inquiry)
            document = InquiryDocument(
                id=request.document_id,
                inquiry_id=inquiry.id,
                filename=request.filename,
                source_key=request.source_key,
                file_type=request.file_type,
            )
            await self.inquiries.save_document(document)
            if request.import_key:
                await self.inquiries.register_import(request.import_key, inquiry.id)
            response = document.to_model()
        return response

    async def register_attachments(
        self, parent: InquiryDocumentModel, filenames: list[str]
    ) -> list[InquiryDocumentModel]:
        if not filenames:
            return []
        async with self.transactions.atomic():
            inquiry = await self.inquiries.get_record(
                parent.inquiry_id, for_update=True
            )
            if inquiry is None or inquiry.deletion_requested_at is not None:
                raise HTTPException(
                    status_code=409, detail="Inquiry is no longer available"
                )
            documents: list[InquiryDocumentModel] = []
            for filename in filenames:
                document = InquiryDocument(
                    inquiry_id=parent.inquiry_id,
                    parent_document_id=parent.id,
                    filename=filename,
                    file_type=FileType.PDF,
                )
                document.source_key = str(document.id)
                await self.inquiries.save_document(document)
                documents.append(document.to_model())
        return documents

    async def source_documents(
        self, inquiry_id: UUID, document_id: UUID
    ) -> list[InquiryDocumentModel]:
        documents = await self.inquiries.list_documents(inquiry_id)
        root = next(
            (document for document in documents if document.id == document_id), None
        )
        if root is None:
            raise ValueError("Extraction document must belong to the inquiry")
        return [
            root,
            *[
                document
                for document in documents
                if document.parent_document_id == root.id
            ],
        ]

    async def prepare_upload(
        self, document: InquiryDocumentModel
    ) -> ExtractionJobStatus:
        job = ExtractionJob(
            source_key=document.source_key,
            inquiry_id=document.inquiry_id,
            document_id=document.id,
        )
        await self.repository.save(job)
        await self.inquiries.mark_import_prepared(document.inquiry_id)
        return job.to_model()

    async def get_latest(self, inquiry_id: UUID) -> ExtractionJobStatus | None:
        job = await self.repository.get_latest(inquiry_id)
        return job.to_model() if job is not None else None

    async def get(self, job_id: UUID) -> ExtractionJobStatus:
        job = await self.repository.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Extraction job not found")
        return job.to_model()

    async def restart(self, inquiry_id: UUID) -> ExtractionJobStatus:
        async with self.transactions.atomic():
            inquiry = await self.inquiries.get_record(inquiry_id, for_update=True)
            if inquiry is None:
                raise HTTPException(status_code=404, detail="Inquiry not found")
            if inquiry.deletion_requested_at is not None:
                raise HTTPException(status_code=409, detail="Inquiry is being deleted")
            previous = await self.repository.get_latest(inquiry_id)
            if (
                previous is None
                or not previous.source_key
                or previous.document_id is None
            ):
                raise HTTPException(
                    status_code=409, detail="No extraction source available"
                )
            if previous.status in ACTIVE_JOB_STATUSES:
                raise HTTPException(
                    status_code=409, detail="Extraction is already running"
                )
            matching = await self.matching_repository.get(previous.id)
            if matching is not None and matching.status in ACTIVE_JOB_STATUSES:
                raise HTTPException(
                    status_code=409, detail="Matching is already running"
                )
            job = ExtractionJob(
                inquiry_id=inquiry_id,
                document_id=previous.document_id,
                source_key=previous.source_key,
            )
            await self.repository.save(job)
            response = job.to_model()
        logger.info(
            "extraction_job_restarted",
            inquiry_id=str(inquiry_id),
            job_id=str(response.id),
        )
        return await self.enqueue(response)

    async def enqueue(self, job: ExtractionJobStatus) -> ExtractionJobStatus:
        try:
            await self._publish(job.id)
        except ExtractionQueueUnavailable as exc:
            logger.exception("extraction_enqueue_failed", job_id=str(job.id))
            await self.fail(job.id, queued_only=True)
            raise HTTPException(
                status_code=503,
                detail={
                    "message": "Extraction queue unavailable",
                    "job_id": str(job.id),
                },
            ) from exc
        logger.info("extraction_job_queued", job_id=str(job.id))
        return job

    async def claim(self, job_id: UUID) -> ExtractionJobStatus | None:
        async with self.transactions.atomic():
            source = await self.repository.get(job_id)
            if source is None or source.inquiry_id is None:
                return None
            inquiry = await self.inquiries.get_record(
                source.inquiry_id, for_update=True
            )
            if inquiry is None or inquiry.deletion_requested_at is not None:
                return None
            job = await self.repository.claim(job_id)
            if job is None:
                return None
            job.status = ExtractionStatus.RUNNING
            job.started_at = datetime.now(UTC)
            await self.repository.save(job)
            return job.to_model()

    async def progress(self, job_id: UUID, step: str, completed_steps: int) -> None:
        async with self.transactions.atomic():
            job = await self.repository.get(job_id, for_update=True)
            if job is None or job.status != ExtractionStatus.RUNNING:
                raise ValueError("Extraction job is no longer running")
            job.current_step = step
            job.completed_steps = completed_steps
            await self.repository.save(job)

    async def complete(
        self, job_id: UUID, result: InquiryExtraction, model: str, prompt_version: str
    ) -> None:
        async with self.transactions.atomic():
            source = await self.repository.get(job_id)
            if source is None:
                raise ValueError("Extraction job not found")
            if source.inquiry_id is None or source.document_id is None:
                raise ValueError(
                    "Extraction job must reference an inquiry and document"
                )
            inquiry = await self.inquiries.get_record(
                source.inquiry_id, for_update=True
            )
            if inquiry is None or inquiry.deletion_requested_at is not None:
                raise ValueError("Extraction inquiry is no longer available")
            job = await self.repository.get(job_id, for_update=True)
            if job is None or job.status != ExtractionStatus.RUNNING:
                raise ValueError("Only running extraction jobs can be completed")
            document = await self.inquiries.get_document(source.document_id)
            if document is None or document.inquiry_id != inquiry.id:
                raise ValueError("Extraction document must belong to the inquiry")
            documents = await self.source_documents(inquiry.id, document.id)
            validate_citations(result, documents)
            snapshot = ExtractionSnapshot(
                inquiry_id=inquiry.id,
                job_id=job_id,
                schema_version=INQUIRY_EXTRACTION_SCHEMA_VERSION,
                model=model,
                prompt_version=prompt_version,
                result=result.model_dump(mode="json"),
            )
            data = map_extraction_to_inquiry(
                result, existing=InquiryData.model_validate(inquiry.daten)
            )
            await self.inquiries.update_data(inquiry.id, data)
            await self.inquiries.save_extraction(snapshot)
            await self.matching.prepare(snapshot.to_model(), data)
            job.status = ExtractionStatus.SUCCEEDED
            job.current_step = None
            job.finished_at = datetime.now(UTC)
            await self.repository.save(job)

    async def fail(
        self, job_id: UUID, *, queued_only: bool = False, error: str | None = None
    ) -> None:
        async with self.transactions.atomic():
            job = await self.repository.get(job_id, for_update=True)
            if job is None or job.status not in ACTIVE_JOB_STATUSES:
                return
            if queued_only and job.status != ExtractionStatus.QUEUED:
                return
            job.status = ExtractionStatus.FAILED
            job.error = (
                "Queue submission failed"
                if queued_only
                else error or "Extraction failed; see worker logs for details"
            )
            job.finished_at = datetime.now(UTC)
            await self.repository.save(job)
