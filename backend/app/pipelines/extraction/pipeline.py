"""Prepare inquiry sources and report extraction progress to the caller."""

from collections.abc import Awaitable, Callable

from fastapi.concurrency import run_in_threadpool

from app.models.domain.inquiries import InquiryDocument
from app.models.jobs.extraction import ClassifiedDocument, InquiryExtraction
from app.pipelines.extraction.document_classification import document_classification
from app.pipelines.extraction.extract import extract_inquiry, recheck_fields
from app.pipelines.extraction.load import load_document
from app.services.shared.minio import MinioService
from app.services.shared.openai import OpenAIService


async def run_pipeline(
    sources: list[InquiryDocument],
    minio: MinioService,
    openai: OpenAIService,
    report_progress: Callable[[str, int], Awaitable[None]],
    confidence_threshold: float,
    rules_prompt: str = "",
) -> InquiryExtraction:
    await report_progress("load", 0)
    if not sources:
        raise ValueError("Extraction requires source documents")
    documents = [(source, await load_document(source, minio)) for source in sources]
    await report_progress("load", 1)

    await report_progress("document_classification", 1)
    classified: list[ClassifiedDocument] = []
    for source, document in documents:
        classified.append(
            await run_in_threadpool(document_classification, document, source)
        )
    await report_progress("document_classification", 2)

    await report_progress("extract", 2)
    extraction = await extract_inquiry(
        classified,
        openai,
        rules_prompt,
    )
    await report_progress("extract", 3)

    await report_progress("recheck_fields", 3)
    extraction = await recheck_fields(
        classified,
        extraction,
        openai,
        confidence_threshold,
        rules_prompt,
    )
    await report_progress("recheck_fields", 4)

    return extraction
