import json

import structlog
from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy
from langchain_core.messages import HumanMessage
from langchain_core.utils.function_calling import convert_to_json_schema

from app.models.jobs.extraction import (
    CUSTOMER_FIELD_NAMES,
    INQUIRY_FIELD_NAMES,
    POSITION_FIELD_NAMES,
    ClassifiedDocument,
    ExtractionSchema,
    FieldsRecheck,
    InquiryExtraction,
    extraction_fields,
)
from app.pipelines.extraction.prompts import (
    FIELDS_RECHECK_PROMPT,
    INQUIRY_EXTRACTION_PROMPT,
    SYSTEM_PROMPT,
)
from app.services.shared.openai import OpenAIService

logger = structlog.get_logger(__name__)


def _ground_citations(
    extraction: InquiryExtraction, document: ClassifiedDocument, document_id: str
) -> InquiryExtraction:
    for _, field in extraction_fields(extraction):
        for citation in field.citations:
            source = document.sources.get(citation.section_id)
            if citation.document_id != document_id or source is None:
                raise ValueError("Citation must reference a known document section")
            citation.bbox = source.bbox.model_copy()
            citation.page_number = source.page_number
            citation.page_width = source.page_width
            citation.page_height = source.page_height
    return extraction


async def _extract_structured[Result: ExtractionSchema](
    document: ClassifiedDocument,
    prompt: str,
    schema: type[Result],
    openai: OpenAIService,
    rules_prompt: str = "",
) -> Result:
    agent = create_agent(
        model=openai.get_chat_model(),
        system_prompt=SYSTEM_PROMPT + rules_prompt,
        response_format=ProviderStrategy(
            convert_to_json_schema(schema, strict=True), strict=True
        ),
    )
    response = await agent.ainvoke(
        {
            "messages": [
                HumanMessage(
                    content=[
                        {"type": "text", "text": prompt},
                        *[
                            {
                                "type": "image_url",
                                "image_url": {"url": image, "detail": "high"},
                            }
                            for image in document.page_images
                        ],
                    ]
                )
            ]
        },
    )
    return schema.model_validate(response["structured_response"])


async def extract_inquiry(
    document: ClassifiedDocument,
    document_id: str,
    openai: OpenAIService,
    rules_prompt: str = "",
) -> InquiryExtraction:
    try:
        prompt = INQUIRY_EXTRACTION_PROMPT.format(
            document_id=document_id, doctags=document.doctags
        )
        extraction = await _extract_structured(
            document, prompt, InquiryExtraction, openai, rules_prompt
        )
        extraction = _ground_citations(extraction, document, document_id)
    except Exception:
        logger.exception("inquiry_extraction_failed", document_id=document_id)
        raise

    logger.info(
        "inquiry_extraction_completed",
        document_id=document_id,
        item_count=len(extraction.positionen or []),
        page_count=len(document.page_images),
    )
    return extraction


async def recheck_fields(
    document: ClassifiedDocument,
    document_id: str,
    extraction: InquiryExtraction,
    openai: OpenAIService,
    confidence_threshold: float,
    rules_prompt: str = "",
) -> InquiryExtraction:
    fields_to_recheck = {
        field_id: field.model_dump(mode="json")
        for field_id, field in extraction_fields(extraction)
        if field.status == "missing"
        or not (field.value or "").strip()
        or field.confidence < confidence_threshold
    }
    if not fields_to_recheck:
        logger.info("fields_recheck_skipped", document_id=document_id)
        return extraction

    logger.info(
        "fields_recheck_started",
        document_id=document_id,
        field_count=len(fields_to_recheck),
        confidence_threshold=confidence_threshold,
    )
    try:
        prompt = FIELDS_RECHECK_PROMPT.format(
            document_id=document_id,
            doctags=document.doctags,
            fields_to_recheck=json.dumps(fields_to_recheck, ensure_ascii=False),
            confidence_threshold=confidence_threshold,
            field_names=json.dumps(
                {
                    "kundeninformationen": CUSTOMER_FIELD_NAMES,
                    "anfrage": INQUIRY_FIELD_NAMES,
                    "positionen": POSITION_FIELD_NAMES,
                },
                ensure_ascii=False,
            ),
            extraction=extraction.model_dump_json(),
        )
        recheck = await _extract_structured(
            document, prompt, FieldsRecheck, openai, rules_prompt
        )
        updates = {field.field_id: field.result for field in recheck.fields}
        if (
            len(updates) != len(recheck.fields)
            or updates.keys() != fields_to_recheck.keys()
        ):
            raise ValueError("Recheck must return each requested field exactly once")
        for field in updates.values():
            if field.status == "missing":
                if field.value is not None or field.citations or not field.note:
                    raise ValueError("Missing fields must have no value and a reason")
            elif not (field.value or "").strip():
                raise ValueError("Recovered fields must have a non-empty value")

        reviewed = extraction.model_copy(deep=True)
        for field_id, field in extraction_fields(reviewed):
            update = updates.get(field_id)
            if update is None:
                continue
            field.value = update.value
            field.confidence = update.confidence
            field.status = update.status
            field.citations = update.citations
            field.note = update.note
        reviewed = _ground_citations(reviewed, document, document_id)
    except Exception:
        logger.exception("fields_recheck_failed", document_id=document_id)
        raise

    logger.info(
        "fields_recheck_completed",
        document_id=document_id,
        field_count=len(fields_to_recheck),
        low_confidence_count=sum(
            field.confidence < confidence_threshold for field in updates.values()
        ),
    )
    return reviewed
