import structlog

from app.models.domain.inquiries import FileType, InquiryDocument
from app.services.shared.minio import MinioService

logger = structlog.get_logger(__name__)


async def load_document(document: InquiryDocument, minio: MinioService) -> bytes:
    if not document.source_key:
        raise ValueError("Extraction source must have a storage key")
    content = await minio.get_inquiry_file(document.source_key)
    signature = (
        b"%PDF-"
        if document.file_type == FileType.PDF
        else b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    )
    if not content or (
        document.file_type != FileType.EML and not content.startswith(signature)
    ):
        raise ValueError("Stored file content does not match its document type")
    logger.info(
        "extraction_document_loaded",
        source_key=document.source_key,
        file_type=document.file_type,
        size=len(content),
    )
    return content
