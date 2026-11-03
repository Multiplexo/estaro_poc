from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
from fastapi import HTTPException
from minio.error import MinioException
from sqlalchemy.exc import SQLAlchemyError
from urllib3.exceptions import HTTPError

from app.models.domain.inquiries import Inquiry, InquiryExtractionSnapshot
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.services.shared.minio import MinioService
from app.services.shared.transactions import TransactionService

logger = structlog.get_logger(__name__)


class InquiryService:
    def __init__(
        self,
        repository: InquiryRepository,
        storage: MinioService,
        transactions: TransactionService,
    ) -> None:
        self.repository = repository
        self.storage = storage
        self.transactions = transactions

    async def get(self, inquiry_id: UUID) -> Inquiry:
        inquiry = await self.repository.get_inquiry(inquiry_id)
        if inquiry is None:
            raise HTTPException(status_code=404, detail="Inquiry not found")
        return inquiry

    async def list_extractions(
        self, inquiry_id: UUID, offset: int, limit: int
    ) -> list[InquiryExtractionSnapshot]:
        await self.get(inquiry_id)
        return await self.repository.list_extractions(inquiry_id, offset, limit)

    async def delete(self, inquiry_id: UUID) -> None:
        async with self.transactions.atomic():
            inquiry = await self.repository.get_record(inquiry_id, for_update=True)
            if inquiry is None:
                raise HTTPException(status_code=404, detail="Inquiry not found")
            if inquiry.deletion_requested_at is None:
                inquiry.deletion_requested_at = datetime.now(UTC)
                inquiry.deletion_retry_at = datetime.now(UTC)
                await self.repository.save(inquiry)
        await self.cleanup(inquiry_id)

    async def cleanup(self, inquiry_id: UUID) -> None:
        try:
            async with self.transactions.atomic():
                record = await self.repository.get_record(inquiry_id, for_update=True)
                if record is None or record.deletion_requested_at is None:
                    return
                inquiry = await self.repository.get_inquiry(inquiry_id)
                if inquiry is None:
                    return
                source_keys = {
                    document.source_key
                    for document in inquiry.documents
                    if document.source_key
                }
                for source_key in sorted(source_keys):
                    await self.storage.delete_inquiry_file(source_key)
                await self.repository.delete_inquiry(inquiry_id)
        except (MinioException, HTTPError, OSError, SQLAlchemyError) as exc:
            logger.exception(
                "inquiry_document_cleanup_failed", inquiry_id=str(inquiry_id)
            )
            await self._schedule_cleanup(inquiry_id)
            raise HTTPException(
                status_code=503,
                detail="Inquiry cleanup pending; retry inquiry deletion",
            ) from exc
        logger.info("inquiry_deleted", inquiry_id=str(inquiry_id))

    async def _schedule_cleanup(self, inquiry_id: UUID) -> None:
        async with self.transactions.atomic():
            inquiry = await self.repository.get_record(inquiry_id, for_update=True)
            if inquiry is not None:
                inquiry.deletion_retry_at = datetime.now(UTC) + timedelta(minutes=1)
                await self.repository.save(inquiry)

    async def cleanup_pending(self) -> None:
        await self._expire_uploads()
        async with self.transactions.atomic():
            inquiry_ids = await self.repository.pending_deletions()
        for inquiry_id in inquiry_ids:
            try:
                await self.cleanup(inquiry_id)
            except (HTTPException, SQLAlchemyError, OSError):
                logger.exception(
                    "inquiry_cleanup_retry_failed", inquiry_id=str(inquiry_id)
                )

    async def _expire_uploads(self) -> None:
        async with self.transactions.atomic():
            inquiry_ids = await self.repository.uploads_without_jobs(
                datetime.now(UTC) - timedelta(hours=1)
            )
        for inquiry_id in inquiry_ids:
            async with self.transactions.atomic():
                inquiry = await self.repository.get_record(inquiry_id, for_update=True)
                if inquiry is None or await self.repository.has_extraction_jobs(
                    inquiry_id
                ):
                    continue
                if inquiry.deletion_requested_at is not None:
                    continue
                inquiry.deletion_requested_at = datetime.now(UTC)
                inquiry.deletion_retry_at = datetime.now(UTC)
                await self.repository.save(inquiry)
            logger.info(
                "abandoned_upload_cleanup_scheduled", inquiry_id=str(inquiry_id)
            )
