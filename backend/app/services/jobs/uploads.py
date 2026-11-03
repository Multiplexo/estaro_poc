from uuid import UUID, uuid4

import structlog
from fastapi import HTTPException, UploadFile
from minio.error import MinioException
from urllib3.exceptions import HTTPError

from app.models.api.extractions import ExtractionRequest
from app.models.jobs.extraction import ExtractionJobStatus
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.services.domain.inquiries import InquiryService
from app.services.jobs.extractions import ExtractionService
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

    async def submit(self, file: UploadFile) -> ExtractionJobStatus:
        try:
            await self.storage.validate_pdf(file)
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
                filename=file.filename or "inquiry.pdf",
            )
        )
        try:
            async with self.transactions.atomic():
                inquiry = await self.inquiries.get_record(
                    document.inquiry_id, for_update=True
                )
                if inquiry is None or inquiry.deletion_requested_at is not None:
                    raise HTTPException(
                        status_code=409, detail="Inquiry is no longer available"
                    )
                await self.storage.upload_inquiry_file(document.id, file)
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
