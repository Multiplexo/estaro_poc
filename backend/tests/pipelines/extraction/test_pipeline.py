from typing import Any
from unittest.mock import AsyncMock, Mock, call
from uuid import uuid4

import pytest

from app.models.domain.inquiries import FileType, InquiryDocument
from app.models.jobs.extraction import (
    Citation,
    ExtractedField,
    FieldsRecheck,
    InquiryExtraction,
    RecheckedField,
    extraction_fields,
)
from app.pipelines.extraction.pipeline import run_pipeline
from app.services.shared.minio import MinioService

pytestmark = pytest.mark.integration


@pytest.fixture
def source() -> InquiryDocument:
    return InquiryDocument(
        inquiry_id=uuid4(),
        filename="inquiry.eml",
        file_type=FileType.EML,
        source_key="tests/inquiry.eml",
    )


@pytest.fixture
def storage() -> AsyncMock:
    minio = AsyncMock(spec=MinioService)
    minio.get_inquiry_file.return_value = (
        b"From: buyer@example.com\r\nSubject: Inquiry\r\n"
        b"Content-Type: text/plain; charset=utf-8\r\n\r\n"
        b"Acme GmbH\r\nInquiry RFQ-42\r\n"
    )
    return minio


@pytest.fixture
def extraction(source: InquiryDocument) -> InquiryExtraction:
    result = InquiryExtraction()
    result.kundeninformationen.name = ExtractedField(
        value="Acme GmbH",
        confidence=0.95,
        status="present",
        citations=[
            Citation(
                document_id=str(source.id), section_id="email-body-1", quote="Acme GmbH"
            )
        ],
    )
    result.anfragenummer = ExtractedField(
        value="RFQ-42",
        confidence=0.2,
        status="present",
        citations=[
            Citation(
                document_id=str(source.id), section_id="email-body-2", quote="RFQ-42"
            )
        ],
    )
    return result


async def test_email_extraction_rechecks_fields_and_reports_progress(
    source: InquiryDocument,
    storage: AsyncMock,
    extraction: InquiryExtraction,
    ai_service: Mock,
    model_responses: dict[str, dict[str, Any]],
    model_requests: list[dict[str, Any]],
) -> None:
    model_responses["InquiryExtraction"] = extraction.model_dump(mode="json")
    updates = []
    for field_id, field in extraction_fields(extraction):
        if field.status != "missing" and field.confidence >= 0.5:
            continue
        updated = field.model_copy(deep=True)
        updated.confidence = 0.95
        if updated.status == "missing":
            updated.note = "Nicht in der Anfrage angegeben."
        updates.append(RecheckedField(field_id=field_id, result=updated))
    model_responses["FieldsRecheck"] = FieldsRecheck(fields=updates).model_dump(
        mode="json"
    )
    progress = AsyncMock()

    result = await run_pipeline(
        [source],
        storage,
        ai_service,
        progress,
        confidence_threshold=0.5,
        rules_prompt="Preserve source units.",
    )

    assert result.kundeninformationen.name.value == "Acme GmbH"
    assert result.anfragenummer.value == "RFQ-42"
    assert result.anfragenummer.confidence == 0.95
    assert result.anfragenummer.citations[0].document_id == str(source.id)
    assert result.anfragenummer.citations[0].page_number is None
    storage.get_inquiry_file.assert_awaited_once_with(source.source_key)
    assert progress.await_args_list == [
        call("load", 0),
        call("load", 1),
        call("document_classification", 1),
        call("document_classification", 2),
        call("extract", 2),
        call("extract", 3),
        call("recheck_fields", 3),
        call("recheck_fields", 4),
    ]
    requests = [
        request
        for request in model_requests
        if request["response_format"]["json_schema"]["name"] != "InjectionDecision"
    ]
    assert len(requests) == 2
    assert all(
        "Preserve source units." in request["messages"][0]["content"]
        for request in requests
    )
    assert str(source.id) in str(requests[0]["messages"])
    assert "section_id=email-body-2" in str(requests[0]["messages"])


@pytest.mark.parametrize("invalid_citation", ["unknown_section", "invented_quote"])
async def test_extraction_rejects_ungrounded_citations(
    source: InquiryDocument,
    storage: AsyncMock,
    extraction: InquiryExtraction,
    ai_service: Mock,
    model_responses: dict[str, dict[str, Any]],
    invalid_citation: str,
) -> None:
    citation = extraction.anfragenummer.citations[0]
    if invalid_citation == "unknown_section":
        citation.section_id = "unknown"
    else:
        citation.quote = "Invented reference"
    model_responses["InquiryExtraction"] = extraction.model_dump(mode="json")
    progress = AsyncMock()

    with pytest.raises(ValueError, match="known document section|verbatim"):
        await run_pipeline([source], storage, ai_service, progress, 0.5)

    assert call("recheck_fields", 4) not in progress.await_args_list


async def test_invalid_email_stops_before_ai_calls(
    source: InquiryDocument,
    storage: AsyncMock,
    ai_service: Mock,
) -> None:
    storage.get_inquiry_file.return_value = b"not an email"
    with pytest.raises(ValueError, match="EML email could not be read"):
        await run_pipeline([source], storage, ai_service, AsyncMock(), 0.5)
    ai_service.get_chat_model.assert_not_called()


async def test_incomplete_recheck_keeps_first_extraction(
    source: InquiryDocument,
    storage: AsyncMock,
    extraction: InquiryExtraction,
    ai_service: Mock,
    model_responses: dict[str, dict[str, Any]],
) -> None:
    model_responses["InquiryExtraction"] = extraction.model_dump(mode="json")
    model_responses["FieldsRecheck"] = {"fields": []}
    progress = AsyncMock()

    result = await run_pipeline([source], storage, ai_service, progress, 0.5)

    assert result.anfragenummer.value == extraction.anfragenummer.value
    assert progress.await_args_list[-1] == call("recheck_fields", 4)
