from datetime import UTC, datetime

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence import Inquiry
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository


@pytest.fixture
async def inquiry(db_session: AsyncSession) -> Inquiry:
    record = Inquiry(created_at=datetime.now(UTC))
    await InquiryRepository(db_session).save(record)
    return record
