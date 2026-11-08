from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import Settings
from app.routes.outlook import get_outlook_client
from app.services.shared.database import get_session
from app.services.shared.outlook import OutlookClient
from tests.types import OverrideDependency


async def test_outlook_callback_rejects_missing_state(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    outlook = override_dependency(get_outlook_client, OutlookClient)
    outlook.settings = Settings(_env_file=None)
    override_dependency(get_session, AsyncSession)
    response = await client.get("/auth/callback?code=test-code")
    assert response.status_code == 303
    assert response.headers["location"].endswith("/einstellungen?outlook=state")
    assert response.headers["cache-control"] == "no-store"
    outlook.exchange_code.assert_not_awaited()
