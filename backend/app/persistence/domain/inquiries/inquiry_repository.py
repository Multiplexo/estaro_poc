"""Inquiry queries using the shared database service."""

from typing import cast
from uuid import UUID

import structlog
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import InstrumentedAttribute, selectinload
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.inquiries import (
    Inquiry,
    InquiryDocument,
    InquiryExtractionSnapshot,
)
from app.persistence.domain.inquiries.schema.inquiry import Inquiry as InquirySchema
from app.persistence.domain.inquiries.schema.inquiry import (
    InquiryDocument as DocumentSchema,
)
from app.persistence.domain.inquiries.schema.inquiry_extraction import (
    InquiryExtraction as ExtractionSchema,
)

logger = structlog.get_logger(__name__)


class InquiryRepository:
    """Retrieve inquiries with a session per operation."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def delete_inquiry(self, inquiry_id: UUID) -> None:
        try:
            await self.session.exec(
                delete(InquirySchema).where(col(InquirySchema.id) == inquiry_id)
            )
            await self.session.commit()
        except SQLAlchemyError:
            await self.session.rollback()
            logger.exception("inquiry_delete_failed", inquiry_id=str(inquiry_id))
            raise

    async def get_inquiry(self, inquiry_id: UUID) -> Inquiry | None:
        """Return an inquiry and its relationships, or None when absent."""
        try:
            statement = (
                select(InquirySchema)
                .where(InquirySchema.id == inquiry_id)
                .options(
                    selectinload(
                        cast(
                            InstrumentedAttribute[list[DocumentSchema]],
                            cast(object, InquirySchema.documents),
                        )
                    )
                )
            )
            record = (await self.session.exec(statement)).one_or_none()
            return record.to_model() if record is not None else None
        except SQLAlchemyError:
            logger.exception("inquiry_get_failed", inquiry_id=str(inquiry_id))
            raise

    async def list_inquiries(self, offset: int = 0, limit: int = 100) -> list[Inquiry]:
        """Return a page ordered by creation time and UUID."""
        if offset < 0 or limit < 1:
            raise ValueError("offset must be non-negative and limit must be positive")

        try:
            statement = (
                select(InquirySchema)
                .options(
                    selectinload(
                        cast(
                            InstrumentedAttribute[list[DocumentSchema]],
                            cast(object, InquirySchema.documents),
                        )
                    )
                )
                .order_by(col(InquirySchema.created_at), col(InquirySchema.id))
                .offset(offset)
                .limit(limit)
            )
            return [
                record.to_model()
                for record in (await self.session.exec(statement)).all()
            ]
        except SQLAlchemyError:
            logger.exception("inquiry_list_failed", offset=offset, limit=limit)
            raise

    async def get_document(self, document_id: UUID) -> InquiryDocument | None:
        """Return a document by UUID, or None when absent."""
        try:
            record = await self.session.get(DocumentSchema, document_id)
            return record.to_model() if record is not None else None
        except SQLAlchemyError:
            logger.exception(
                "inquiry_document_get_failed", document_id=str(document_id)
            )
            raise

    async def list_extractions(
        self, inquiry_id: UUID, offset: int = 0, limit: int = 100
    ) -> list[InquiryExtractionSnapshot]:
        if offset < 0 or limit < 1:
            raise ValueError("offset must be non-negative and limit must be positive")

        try:
            statement = (
                select(ExtractionSchema)
                .where(ExtractionSchema.inquiry_id == inquiry_id)
                .order_by(
                    col(ExtractionSchema.created_at).desc(),
                    col(ExtractionSchema.id).desc(),
                )
                .offset(offset)
                .limit(limit)
            )
            return [
                record.to_model()
                for record in (await self.session.exec(statement)).all()
            ]
        except SQLAlchemyError:
            logger.exception(
                "inquiry_extraction_list_failed", inquiry_id=str(inquiry_id)
            )
            raise
