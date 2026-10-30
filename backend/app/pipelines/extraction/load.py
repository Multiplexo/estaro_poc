import structlog

from app.services.shared.minio import MinioService

logger = structlog.get_logger(__name__)


async def load_document(source_key: str, minio: MinioService) -> bytes:
    content = await minio.get_inquiry_file(source_key)
    if not content.startswith(b"%PDF-"):
        raise ValueError("Stored file must contain a PDF document")
    logger.info("extraction_document_loaded", source_key=source_key, size=len(content))
    return content
