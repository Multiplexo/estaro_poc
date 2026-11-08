from uuid import uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.inquiries import FileType
from app.persistence import Inquiry, InquiryDocument
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository

pytestmark = pytest.mark.integration


async def test_inquiry_documents_and_delete(
    db_session: AsyncSession, inquiry: Inquiry
) -> None:
    repository = InquiryRepository(db_session)
    documents = [
        InquiryDocument(inquiry_id=inquiry.id, filename=name, file_type=FileType.PDF)
        for name in ["z.pdf", "a.pdf"]
    ]
    for document in documents:
        await repository.save_document(document)

    result = await repository.get_inquiry(inquiry.id)
    assert result is not None
    assert [document.filename for document in result.documents] == ["a.pdf", "z.pdf"]
    assert [
        document.filename for document in await repository.list_documents(inquiry.id)
    ] == ["a.pdf", "z.pdf"]
    document = await repository.get_document(documents[0].id)
    assert document is not None and document.inquiry_id == inquiry.id
    assert await repository.get_document(uuid4()) is None
    assert await repository.get_inquiry(uuid4()) is None
    assert [item.id for item in await repository.list_inquiries()] == [inquiry.id]

    await repository.delete_inquiry(inquiry.id)
    assert await repository.get_inquiry(inquiry.id) is None
    assert await repository.list_documents(inquiry.id) == []


@pytest.mark.parametrize("offset,limit", [(-1, 1), (0, 0)])
async def test_rejects_invalid_pagination(
    db_session: AsyncSession, offset: int, limit: int
) -> None:
    repository = InquiryRepository(db_session)
    with pytest.raises(ValueError, match="offset must be non-negative"):
        await repository.list_inquiries(offset=offset, limit=limit)
