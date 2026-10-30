"""Inquiry endpoints."""

from typing import Annotated
from urllib.parse import quote
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from minio.error import MinioException, S3Error
from urllib3.exceptions import HTTPError

from app.dependencies import MinioServiceDep, get_inquiry_repository
from app.models.api.documents import DocumentUrl
from app.models.domain.inquiries import (
    Inquiry,
    InquiryExtractionSnapshot,
    InquiryOverviewPage,
    InquiryOverviewQuery,
)
from app.models.shared.pagination import Pagination
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository

router = APIRouter()
logger = structlog.get_logger(__name__)
RepositoryDep = Annotated[InquiryRepository, Depends(get_inquiry_repository)]


@router.get("", response_model=list[Inquiry], operation_id="list_inquiries")
async def list_inquiries(
    repository: RepositoryDep,
    pagination: Annotated[Pagination, Depends()],
) -> list[Inquiry]:
    """Return a page of inquiries."""
    return await repository.list_inquiries(
        offset=pagination.offset, limit=pagination.limit
    )


@router.get("/overview", operation_id="list_inquiry_overviews")
async def list_inquiry_overviews(
    repository: RepositoryDep,
    query: Annotated[InquiryOverviewQuery, Depends()],
) -> InquiryOverviewPage:
    return await repository.list_overviews(query)


@router.get("/{inquiry_id}", response_model=Inquiry, operation_id="get_inquiry_by_id")
async def get_inquiry_by_id(inquiry_id: UUID, repository: RepositoryDep) -> Inquiry:
    """Return an inquiry by ID."""
    inquiry = await repository.get_inquiry(inquiry_id)
    if inquiry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquiry not found",
        )
    return inquiry


@router.delete(
    "/{inquiry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id="delete_inquiry",
)
async def delete_inquiry(
    inquiry_id: UUID,
    repository: RepositoryDep,
    minio: MinioServiceDep,
) -> Response:
    inquiry = await get_inquiry_by_id(inquiry_id, repository)
    source_keys = {
        document.source_key for document in inquiry.documents if document.source_key
    }
    try:
        for source_key in sorted(source_keys):
            await minio.delete_inquiry_file(source_key)
    except (MinioException, HTTPError, OSError) as exc:
        logger.exception("inquiry_document_cleanup_failed", inquiry_id=str(inquiry_id))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage unavailable; retry inquiry deletion",
        ) from exc

    await repository.delete_inquiry(inquiry_id)
    logger.info("inquiry_deleted", inquiry_id=str(inquiry_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{inquiry_id}/extractions", operation_id="list_inquiry_extractions")
async def list_inquiry_extractions(
    inquiry_id: UUID,
    repository: RepositoryDep,
    pagination: Annotated[Pagination, Depends()],
) -> list[InquiryExtractionSnapshot]:
    await get_inquiry_by_id(inquiry_id, repository)
    return await repository.list_extractions(
        inquiry_id, offset=pagination.offset, limit=pagination.limit
    )


@router.get(
    "/{inquiry_id}/documents/{document_id}/url",
    operation_id="get_inquiry_document_url",
    response_model=DocumentUrl,
)
async def get_inquiry_document_url(
    inquiry_id: UUID,
    document_id: UUID,
    repository: RepositoryDep,
    minio: MinioServiceDep,
    response: Response,
) -> DocumentUrl:
    inquiry = await get_inquiry_by_id(inquiry_id, repository)
    document = next(
        (item for item in inquiry.documents if item.id == document_id), None
    )
    if document is None or not document.source_key:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        url = await minio.get_inquiry_file_url(
            document.source_key, document.filename, document.file_type.media_type
        )
    except (MinioException, HTTPError, OSError) as exc:
        logger.exception(
            "inquiry_document_url_failed",
            inquiry_id=str(inquiry_id),
            document_id=str(document_id),
        )
        raise HTTPException(status_code=503, detail="File storage unavailable") from exc

    response.headers["Cache-Control"] = "no-store"
    return DocumentUrl(url=url)


@router.get(
    "/{inquiry_id}/documents/{document_id}",
    operation_id="download_inquiry_document",
    response_class=Response,
    responses={
        200: {
            "content": {
                "application/octet-stream": {
                    "schema": {"type": "string", "format": "binary"}
                }
            }
        }
    },
)
async def download_inquiry_document(
    inquiry_id: UUID,
    document_id: UUID,
    repository: RepositoryDep,
    minio: MinioServiceDep,
) -> Response:
    inquiry = await get_inquiry_by_id(inquiry_id, repository)
    document = next(
        (item for item in inquiry.documents if item.id == document_id), None
    )
    if document is None or not document.source_key:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        content = await minio.get_inquiry_file(document.source_key)
    except (MinioException, HTTPError, OSError) as exc:
        logger.exception(
            "inquiry_document_download_failed",
            inquiry_id=str(inquiry_id),
            document_id=str(document_id),
        )
        if isinstance(exc, S3Error) and exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise HTTPException(status_code=404, detail="Document not found") from exc
        raise HTTPException(status_code=503, detail="File storage unavailable") from exc

    return Response(
        content=content,
        media_type=document.file_type.media_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(document.filename, safe='')}",
            "X-Content-Type-Options": "nosniff",
        },
    )
