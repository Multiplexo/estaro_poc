from uuid import UUID

import structlog
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from minio.error import MinioException, S3Error
from urllib3.exceptions import HTTPError

from app.models.api.documents import DocumentUrl
from app.models.domain.documents import DocumentSection
from app.models.domain.inquiries import InquiryDocument
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.services.shared.email import parse_email
from app.services.shared.minio import MinioService

logger = structlog.get_logger(__name__)


class InquiryDocumentService:
    def __init__(self, repository: InquiryRepository, storage: MinioService) -> None:
        self.repository = repository
        self.storage = storage

    async def get(self, inquiry_id: UUID, document_id: UUID) -> InquiryDocument:
        inquiry = await self.repository.get_record(inquiry_id)
        if inquiry is None:
            raise HTTPException(status_code=404, detail="Inquiry not found")
        if inquiry.deletion_requested_at is not None:
            raise HTTPException(status_code=409, detail="Inquiry is being deleted")
        document = await self.repository.get_document(document_id)
        if (
            document is None
            or document.inquiry_id != inquiry_id
            or not document.source_key
        ):
            raise HTTPException(status_code=404, detail="Document not found")
        return document

    async def get_url(self, inquiry_id: UUID, document_id: UUID) -> DocumentUrl:
        document = await self.get(inquiry_id, document_id)
        if not document.source_key:
            raise HTTPException(status_code=404, detail="Document not found")
        try:
            url = await self.storage.get_inquiry_file_url(
                document.source_key,
                document.filename,
                document.file_type.media_type,
            )
        except (MinioException, HTTPError, OSError) as exc:
            logger.exception(
                "inquiry_document_url_failed",
                inquiry_id=str(inquiry_id),
                document_id=str(document_id),
            )
            raise HTTPException(
                status_code=503, detail="File storage unavailable"
            ) from exc
        return DocumentUrl(url=url)

    async def download(self, document: InquiryDocument) -> bytes:
        if not document.source_key:
            raise HTTPException(status_code=404, detail="Document not found")
        try:
            return await self.storage.get_inquiry_file(document.source_key)
        except (MinioException, HTTPError, OSError) as exc:
            logger.exception(
                "inquiry_document_download_failed", document_id=str(document.id)
            )
            if isinstance(exc, S3Error) and exc.code in {"NoSuchKey", "NoSuchObject"}:
                raise HTTPException(
                    status_code=404, detail="Document not found"
                ) from exc
            raise HTTPException(
                status_code=503, detail="File storage unavailable"
            ) from exc

    async def sections(
        self, inquiry_id: UUID, document_id: UUID
    ) -> list[DocumentSection]:
        document = await self.get(inquiry_id, document_id)
        if not document.file_type.is_email:
            return []
        content = await self.download(document)
        try:
            email = await run_in_threadpool(
                parse_email, content, document.file_type, include_attachments=False
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail="Email content could not be read"
            ) from exc
        return email.sections
