import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence.domain.outlook.outlook_repository import OutlookRepository

pytestmark = pytest.mark.integration


async def test_outlook_connection_preserves_delta_only_for_same_account(
    db_session: AsyncSession,
) -> None:
    repository = OutlookRepository(db_session)
    assert await repository.is_connected() is False
    assert await repository.lock_connection() is None
    await repository.connect("account-1", "encrypted-test-token")
    assert await repository.is_connected() is True
    connection = await repository.lock_connection()
    assert connection is not None
    connection.delta_link = "https://graph.example/delta"
    await repository.save(connection)
    await repository.connect("account-1", "rotated-test-token")
    connection = await repository.lock_connection()
    assert connection is not None
    assert connection.refresh_token == "rotated-test-token"
    assert connection.delta_link == "https://graph.example/delta"
    await repository.connect("account-2", "another-test-token")
    connection = await repository.lock_connection()
    assert connection is not None and connection.delta_link is None
    await repository.disconnect()
    assert await repository.is_connected() is False
