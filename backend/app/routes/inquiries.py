from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.config import SettingsDep
from app.dependencies import (
    get_document_service,
    get_extraction_service,
    get_inquiry_repository,
    get_inquiry_service,
)
from app.models.api.documents import DocumentUrl
from app.models.domain.documents import DocumentSection
from app.models.domain.inquiries import (
    Inquiry,
    InquiryExtractionSnapshot,
    InquiryOverviewPage,
    InquiryOverviewQuery,
)
from app.models.jobs.extraction import ExtractionJobStatus
from app.models.shared.pagination import Pagination
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.services.domain.documents import InquiryDocumentService
from app.services.domain.inquiries import InquiryService
from app.services.domain.sage_export import ExportNotReadyError, export_inquiry
from app.services.jobs.extractions import ExtractionService

router = APIRouter()
RepositoryDep = Annotated[InquiryRepository, Depends(get_inquiry_repository)]
ServiceDep = Annotated[InquiryService, Depends(get_inquiry_service)]
DocumentServiceDep = Annotated[InquiryDocumentService, Depends(get_document_service)]
ExtractionServiceDep = Annotated[ExtractionService, Depends(get_extraction_service)]


@router.get("", response_model=list[Inquiry], operation_id="list_inquiries")
async def list_inquiries(
    repository: RepositoryDep, pagination: Annotated[Pagination, Depends()]
) -> list[Inquiry]:
    return await repository.list_inquiries(
        offset=pagination.offset, limit=pagination.limit
    )


@router.get("/overview", operation_id="list_inquiry_overviews")
async def list_inquiry_overviews(
    repository: RepositoryDep, query: Annotated[InquiryOverviewQuery, Depends()]
) -> InquiryOverviewPage:
    return await repository.list_overviews(query)


@router.get("/{inquiry_id}", response_model=Inquiry, operation_id="get_inquiry_by_id")
async def get_inquiry_by_id(inquiry_id: UUID, service: ServiceDep) -> Inquiry:
    return await service.get(inquiry_id)


@router.delete(
    "/{inquiry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    operation_id="delete_inquiry",
)
async def delete_inquiry(inquiry_id: UUID, service: ServiceDep) -> Response:
    await service.delete(inquiry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{inquiry_id}/extraction-job", operation_id="get_inquiry_extraction_job")
async def get_inquiry_extraction_job(
    inquiry_id: UUID, inquiries: ServiceDep, service: ExtractionServiceDep
) -> ExtractionJobStatus | None:
    await inquiries.get(inquiry_id)
    return await service.get_latest(inquiry_id)


@router.post(
    "/{inquiry_id}/extractions",
    status_code=status.HTTP_202_ACCEPTED,
    operation_id="restart_inquiry_extraction",
)
async def restart_inquiry_extraction(
    inquiry_id: UUID, service: ExtractionServiceDep
) -> ExtractionJobStatus:
    return await service.restart(inquiry_id)


@router.get("/{inquiry_id}/extractions", operation_id="list_inquiry_extractions")
async def list_inquiry_extractions(
    inquiry_id: UUID, service: ServiceDep, pagination: Annotated[Pagination, Depends()]
) -> list[InquiryExtractionSnapshot]:
    return await service.list_extractions(
        inquiry_id, pagination.offset, pagination.limit
    )


@router.get(
    "/{inquiry_id}/documents/{document_id}/sections",
    operation_id="get_inquiry_document_sections",
)
async def get_inquiry_document_sections(
    inquiry_id: UUID, document_id: UUID, service: DocumentServiceDep
) -> list[DocumentSection]:
    return await service.sections(inquiry_id, document_id)


@router.get(
    "/{inquiry_id}/documents/{document_id}/url",
    operation_id="get_inquiry_document_url",
    response_model=DocumentUrl,
)
async def get_inquiry_document_url(
    inquiry_id: UUID, document_id: UUID, service: DocumentServiceDep, response: Response
) -> DocumentUrl:
    result = await service.get_url(inquiry_id, document_id)
    response.headers["Cache-Control"] = "no-store"
    return result


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
    inquiry_id: UUID, document_id: UUID, service: DocumentServiceDep
) -> Response:
    document = await service.get(inquiry_id, document_id)
    content = await service.download(document)
    return Response(
        content=content,
        media_type=document.file_type.media_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(document.filename, safe='')}",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get(
    "/{inquiry_id}/export",
    operation_id="export_inquiry_for_sage",
    response_class=Response,
    responses={
        200: {
            "content": {"text/csv": {"schema": {"type": "string", "format": "binary"}}}
        },
        409: {"description": "Customer or article numbers are missing"},
    },
)
async def export_inquiry_for_sage(
    inquiry_id: UUID, service: ServiceDep, settings: SettingsDep
) -> Response:
    """Create the Sage import file for a reviewed inquiry."""
    inquiry = await service.get(inquiry_id)
    try:
        export = export_inquiry(
            inquiry.daten, str(inquiry.id)[:8], settings.SAGE_EXPORT_MAPPING or None
        )
    except ExportNotReadyError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return Response(
        content=export.content,
        media_type=export.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{export.filename}"',
            "Cache-Control": "no-store",
        },
    )
