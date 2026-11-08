from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.dependencies import (
    get_document_service,
    get_inquiry_repository,
    get_inquiry_service,
)
from app.models.api.documents import DocumentUrl
from app.models.domain.inquiries import Inquiry
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.services.domain.documents import InquiryDocumentService
from app.services.domain.inquiries import InquiryService
from tests.types import OverrideDependency


async def test_inquiry_get_and_delete(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    service = override_dependency(get_inquiry_service, InquiryService)
    inquiry = Inquiry(created_at=datetime.now(UTC))
    service.get.return_value = inquiry
    response = await client.get(f"/inquiries/{inquiry.id}")
    assert response.status_code == 200
    assert response.json() == inquiry.model_dump(mode="json")
    response = await client.delete(f"/inquiries/{inquiry.id}")
    assert response.status_code == 204
    assert response.content == b""
    service.delete.assert_awaited_once_with(inquiry.id)


async def test_service_http_error_is_preserved(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    service = override_dependency(get_inquiry_service, InquiryService)
    service.get.side_effect = HTTPException(status_code=404, detail="Inquiry not found")
    response = await client.get(f"/inquiries/{uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Inquiry not found"}


async def test_document_url_is_not_cached(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    service = override_dependency(get_document_service, InquiryDocumentService)
    inquiry_id, document_id = uuid4(), uuid4()
    service.get_url.return_value = DocumentUrl(url="https://storage.example/document")
    response = await client.get(f"/inquiries/{inquiry_id}/documents/{document_id}/url")
    assert response.status_code == 200
    assert response.json() == {"url": "https://storage.example/document"}
    assert response.headers["cache-control"] == "no-store"
    service.get_url.assert_awaited_once_with(inquiry_id, document_id)


async def test_list_pagination(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    repository = override_dependency(get_inquiry_repository, InquiryRepository)
    repository.list_inquiries.return_value = []
    response = await client.get("/inquiries", params={"offset": 2, "limit": 5})
    assert response.status_code == 200
    assert response.json() == []
    repository.list_inquiries.assert_awaited_once_with(offset=2, limit=5)


@pytest.mark.parametrize("query", ["offset=-1", "limit=0", "limit=1001"])
async def test_list_rejects_invalid_pagination(
    client: AsyncClient, override_dependency: OverrideDependency, query: str
) -> None:
    repository = override_dependency(get_inquiry_repository, InquiryRepository)
    response = await client.get(f"/inquiries?{query}")
    assert response.status_code == 422
    repository.list_inquiries.assert_not_awaited()
