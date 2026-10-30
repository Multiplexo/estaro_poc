"""Load the source PDF and report extraction progress to the caller."""

from collections.abc import Awaitable, Callable
from uuid import UUID

from fastapi.concurrency import run_in_threadpool

from app.models.jobs.extraction import InquiryExtraction
from app.pipelines.extraction.document_classification import document_classification
from app.pipelines.extraction.extract import extract_inquiry
from app.pipelines.extraction.load import load_document
from app.services.shared.minio import MinioService
from app.services.shared.openai import OpenAIService


async def run_pipeline(
    source_key: str,
    minio: MinioService,
    openai: OpenAIService,
    report_progress: Callable[[str, int], Awaitable[None]],
    document_id: UUID,
) -> InquiryExtraction:
    await report_progress("load", 0)
    document = await load_document(source_key, minio)
    await report_progress("load", 1)

    await report_progress("document_classification", 1)
    classified = await run_in_threadpool(document_classification, document)
    await report_progress("document_classification", 2)

    await report_progress("extract", 2)
    extraction = await extract_inquiry(
        classified,
        str(document_id),
        openai,
    )
    await report_progress("extract", 3)

    return extraction
