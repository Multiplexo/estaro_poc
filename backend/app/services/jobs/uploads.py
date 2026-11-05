from uuid import UUID, uuid4

import structlog
from fastapi import HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from minio.error import MinioException
from urllib3.exceptions import HTTPError

from app.models.api.extractions import ExtractionRequest
from app.models.domain.documents import EmailAttachment
from app.models.domain.inquiries import FileType
from app.models.jobs.extraction import ExtractionJobStatus, ExtractionStatus
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.services.domain.inquiries import InquiryService
from app.services.jobs.extractions import ExtractionService
from app.services.shared.email import parse_email
from app.services.shared.minio import MinioService
from app.services.shared.transactions import TransactionService

logger = structlog.get_logger(__name__)


class ExtractionUploadService:
    def __init__(
        self,
        extractions: ExtractionService,
        inquiries: InquiryRepository,
        cleanup: InquiryService,
        storage: MinioService,
        transactions: TransactionService,
    ) -> None:
        self.extractions = extractions
        self.inquiries = inquiries
        self.cleanup = cleanup
        self.storage = storage
        self.transactions = transactions

    async def resume_email(self, import_key: str) -> bool:
        imported = await self.inquiries.get_import(import_key)
        if imported is None:
            return False
        if not imported.prepared:
            if imported.inquiry_id is not None:
                await self.cleanup.delete(imported.inquiry_id)
            return False
        if imported.inquiry_id is None:
            return True
        inquiry = await self.inquiries.get_record(imported.inquiry_id)
        if inquiry is None or inquiry.deletion_requested_at is not None:
            return True
        job = await self.extractions.get_latest(inquiry.id)
        if job is None:
            raise ValueError("Prepared email import must reference an extraction job")
        if job.status == ExtractionStatus.QUEUED:
            await self.extractions.enqueue(job)
        elif job.status == ExtractionStatus.FAILED and job.started_at is None:
            await self.extractions.restart(inquiry.id)
        logger.info(
            "email_import_resumed", import_key=import_key, inquiry_id=str(inquiry.id)
        )
        return True

    async def submit_email(self, file: UploadFile, import_key: str) -> None:
        if await self.resume_email(import_key):
            return
        job = await self.submit(file, import_key=import_key)
        logger.info("email_import_submitted", import_key=import_key, job_id=str(job.id))

    async def submit(
        self, file: UploadFile, *, import_key: str | None = None
    ) -> ExtractionJobStatus:
        attachments: list[EmailAttachment] = []
        try:
            file_type = await self.storage.validate_file(file)
            if file_type.is_email:
                email = await run_in_threadpool(
                    parse_email, await file.read(), file_type
                )
                attachments = email.attachments
                await file.seek(0)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except OSError as exc:
            logger.exception("extraction_upload_validation_failed")
            raise HTTPException(
                status_code=503, detail="Uploaded file unavailable"
            ) from exc
        document_id = uuid4()
        document = await self.extractions.register_upload(
            ExtractionRequest(
                source_key=str(document_id),
                document_id=document_id,
                filename=file.filename or f"inquiry.{file_type.value}",
                file_type=file_type,
                import_key=import_key,
            )
        )
        try:
            children = await self.extractions.register_attachments(
                document, [attachment.filename for attachment in attachments]
            )
            async with self.transactions.atomic():
                inquiry = await self.inquiries.get_record(
                    document.inquiry_id, for_update=True
                )
                if inquiry is None or inquiry.deletion_requested_at is not None:
                    raise HTTPException(
                        status_code=409, detail="Inquiry is no longer available"
                    )
                await self.storage.upload_inquiry_file(document.id, file)
                for child, attachment in zip(children, attachments, strict=True):
                    await self.storage.upload_object(
                        str(child.id), attachment.content, FileType.PDF.media_type
                    )
                job = await self.extractions.prepare_upload(document)
        except (MinioException, HTTPError, OSError) as exc:
            logger.exception("extraction_upload_failed", document_id=str(document_id))
            await self._cleanup_failed_upload(document.inquiry_id)
            raise HTTPException(
                status_code=503, detail="File storage unavailable"
            ) from exc
        except BaseException:
            logger.exception(
                "extraction_upload_registration_failed", document_id=str(document_id)
            )
            await self._cleanup_failed_upload(document.inquiry_id)
            raise
        return await self.extractions.enqueue(job)

    async def _cleanup_failed_upload(self, inquiry_id: UUID) -> None:
        try:
            await self.cleanup.delete(inquiry_id)
        except Exception:
            logger.exception(
                "extraction_upload_cleanup_failed", inquiry_id=str(inquiry_id)
            )
