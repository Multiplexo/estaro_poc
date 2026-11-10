"""Prepare inquiry sources and report extraction progress to the caller."""

import json
from collections.abc import Awaitable, Callable
from uuid import UUID

import structlog
from fastapi.concurrency import run_in_threadpool

from app.models.domain.inquiries import InquiryDocument
from app.models.jobs.agent_memory import ExtractionFeedback
from app.models.jobs.extraction import ClassifiedDocument, InquiryExtraction
from app.persistence.jobs.extractions.memory_repository import ReviewedMemoryRepository
from app.pipelines.extraction.document_classification import document_classification
from app.pipelines.extraction.extract import extract_inquiry, recheck_fields
from app.pipelines.extraction.load import load_document
from app.services.shared.ai import AIService
from app.services.shared.minio import MinioService

logger = structlog.get_logger(__name__)


def extraction_memory_context(examples: list[ExtractionFeedback]) -> str:
    entries: list[str] = []
    remaining = 24000
    for example in examples:
        sources = json.loads(example.source_input)
        fields: dict[str, object] = {}
        for field_id, value in example.confirmed_fields.items():
            source = sources[field_id]
            entry = {
                "original_value": source["original_value"],
                "quotes": [quote[:1000] for quote in source["quotes"][:3]],
                "confirmed_value": value,
            }
            size = len(json.dumps({field_id: entry}, ensure_ascii=False))
            if size > remaining:
                continue
            fields[field_id] = entry
            remaining -= size
        if fields:
            entries.append(
                json.dumps(
                    {"example_id": str(example.id), "fields": fields},
                    ensure_ascii=False,
                )
            )
    return "\n".join(entries)


async def run_pipeline(
    sources: list[InquiryDocument],
    minio: MinioService,
    ai_service: AIService,
    report_progress: Callable[[str, int], Awaitable[None]],
    confidence_threshold: float,
    rules_prompt: str = "",
    memory: ReviewedMemoryRepository | None = None,
    inquiry_id: UUID | None = None,
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

    memory_context = ""
    if memory is not None and inquiry_id is not None:
        examples = await memory.search_extraction(
            "\n".join(document.content for document in classified), inquiry_id
        )
        memory_context = extraction_memory_context(examples)
        logger.info(
            "extraction_memory_retrieved",
            inquiry_id=str(inquiry_id),
            example_ids=[str(example.id) for example in examples],
        )

    await report_progress("extract", 2)
    extraction = await extract_inquiry(
        classified,
        ai_service,
        rules_prompt,
        memory_context,
    )
    await report_progress("extract", 3)

    await report_progress("recheck_fields", 3)
    extraction = await recheck_fields(
        classified,
        extraction,
        ai_service,
        confidence_threshold,
        rules_prompt,
        memory_context,
    )
    await report_progress("recheck_fields", 4)

    return extraction
