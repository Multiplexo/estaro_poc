import structlog
from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy
from langchain_core.messages import HumanMessage
from langchain_core.utils.function_calling import convert_to_json_schema

from app.models.jobs.extraction import (
    ClassifiedDocument,
    InquiryExtraction,
    extraction_fields,
)
from app.pipelines.extraction.prompts import INQUIRY_EXTRACTION_PROMPT, SYSTEM_PROMPT
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


async def extract_inquiry(
    document: ClassifiedDocument, document_id: str, openai: OpenAIService
) -> InquiryExtraction:
    try:
        prompt = INQUIRY_EXTRACTION_PROMPT.format(
            document_id=document_id, doctags=document.doctags
        )
        agent = create_agent(
            model=openai.get_chat_model(),
            system_prompt=SYSTEM_PROMPT,
            response_format=ProviderStrategy(
                convert_to_json_schema(InquiryExtraction, strict=True), strict=True
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
        extraction = InquiryExtraction.model_validate(response["structured_response"])
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
