"""Upload inquiry PDFs and retrieve extraction job status."""

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from minio.error import MinioException
from urllib3.exceptions import HTTPError

from app.dependencies import MinioServiceDep, get_extraction_service
from app.models.api.extractions import ExtractionRequest, ExtractionResultUpdate
from app.models.domain.inquiries import InquiryExtractionSnapshot
from app.models.jobs.extraction import ExtractionJobStatus
from app.services.jobs.extractions import ExtractionService

router = APIRouter()
ServiceDep = Annotated[ExtractionService, Depends(get_extraction_service)]


@router.post("", status_code=status.HTTP_202_ACCEPTED, operation_id="extraction")
async def submit_extraction(
    file: Annotated[UploadFile, File()],
    service: ServiceDep,
    minio: MinioServiceDep,
) -> ExtractionJobStatus:
    document_id = uuid4()
    try:
        source_key = await minio.upload_inquiry_file(document_id, file)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    except (MinioException, HTTPError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="File storage unavailable",
        ) from exc

    return await service.submit(
        ExtractionRequest(
            source_key=source_key,
            document_id=document_id,
            filename=file.filename or "inquiry.pdf",
        )
    )


@router.get("/{job_id}", operation_id="get_extraction_status")
async def get_extraction_status(
    job_id: UUID, service: ServiceDep
) -> ExtractionJobStatus:
    return await service.get(job_id)


@router.get("/{job_id}/result", operation_id="get_extraction_result")
async def get_extraction_result(
    job_id: UUID, service: ServiceDep
) -> InquiryExtractionSnapshot:
    return await service.get_result(job_id)


@router.patch("/{job_id}/result", operation_id="update_extraction_result")
async def update_extraction_result(
    job_id: UUID, request: ExtractionResultUpdate, service: ServiceDep
) -> InquiryExtractionSnapshot:
    return await service.update_result(job_id, request)
