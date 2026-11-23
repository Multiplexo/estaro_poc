from collections.abc import AsyncIterator
from secrets import compare_digest, token_urlsafe
from typing import Annotated
from urllib.parse import urlencode

import httpx
import structlog
from authlib.integrations.base_client.errors import OAuthError
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from fastapi import APIRouter, Cookie, Depends, Query, Response
from fastapi.responses import RedirectResponse
from kiota_abstractions.api_error import APIError
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings, SettingsDep
from app.dependencies import SessionDep, require_admin
from app.models.domain.outlook import OutlookConnectionStatus
from app.persistence.domain.outlook.outlook_repository import OutlookRepository
from app.services.shared.outlook import OutlookClient, create_outlook_client

logger = structlog.get_logger(__name__)
router = APIRouter()
OAUTH_COOKIE = "outlook_oauth_verifier"


async def get_outlook_client(settings: SettingsDep) -> AsyncIterator[OutlookClient]:
    async with create_outlook_client(settings) as client:
        yield client


OutlookClientDep = Annotated[OutlookClient, Depends(get_outlook_client)]


def frontend_redirect(
    settings: Settings, *, error: str | None = None
) -> RedirectResponse:
    path = f"/einstellungen?{urlencode({'outlook': error or 'connected'})}"
    response = RedirectResponse(f"{settings.MS_FRONTEND_URL}{path}", status_code=303)
    response.delete_cookie(OAUTH_COOKIE, path="/")
    response.delete_cookie(OAUTH_COOKIE, path="/auth")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@router.get(
    "/login", operation_id="connect_outlook", dependencies=[Depends(require_admin)]
)
async def login(outlook: OutlookClientDep) -> RedirectResponse:
    verifier = token_urlsafe(64)
    try:
        url = outlook.authorization_url(verifier)
    except ValueError:
        logger.exception("microsoft_login_configuration_failed")
        return frontend_redirect(outlook.settings, error="configuration")
    response = RedirectResponse(url, status_code=302)
    response.delete_cookie(OAUTH_COOKIE, path="/auth")
    response.set_cookie(
        OAUTH_COOKIE,
        verifier,
        max_age=600,
        httponly=True,
        secure=outlook.settings.MS_REDIRECT_URI.startswith("https://"),
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get(
    "/callback", operation_id="outlook_callback", dependencies=[Depends(require_admin)]
)
async def callback(
    outlook: OutlookClientDep,
    session: SessionDep,
    code: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    error: Annotated[str | None, Query()] = None,
    verifier: Annotated[str | None, Cookie(alias=OAUTH_COOKIE)] = None,
) -> RedirectResponse:
    if (
        not verifier
        or not state
        or not compare_digest(create_s256_code_challenge(verifier), state)
    ):
        logger.warning("microsoft_login_rejected", reason="invalid_state")
        return frontend_redirect(outlook.settings, error="state")
    if error or not code:
        logger.warning("microsoft_login_rejected", reason="authorization_denied")
        return frontend_redirect(outlook.settings, error="denied")
    try:
        tokens = await outlook.exchange_code(code, verifier)
        if not tokens.refresh_token:
            return frontend_redirect(outlook.settings, error="offline_access")
        account = await outlook.account()
        await OutlookRepository(session).connect(
            account.id, outlook.encrypt_token(tokens.refresh_token)
        )
    except (
        httpx.HTTPError,
        OAuthError,
        APIError,
        ValueError,
        SQLAlchemyError,
        OSError,
    ):
        logger.exception("outlook_authorization_failed")
        return frontend_redirect(outlook.settings, error="unavailable")
    logger.info("outlook_connection_connected")
    return frontend_redirect(outlook.settings)


@router.get("/connection", operation_id="get_outlook_connection")
async def get_outlook_connection(
    outlook: OutlookClientDep, session: SessionDep, response: Response
) -> OutlookConnectionStatus:
    configured = True
    try:
        outlook.validate_configuration()
    except ValueError:
        configured = False
    response.headers["Cache-Control"] = "no-store"
    return OutlookConnectionStatus(
        connected=await OutlookRepository(session).is_connected(),
        configured=configured,
        fetch_enabled=outlook.settings.MS_FETCH_ENABLED,
        fetch_interval_seconds=outlook.settings.MS_FETCH_INTERVAL_SECONDS,
    )


@router.delete(
    "/connection",
    status_code=204,
    operation_id="disconnect_outlook",
    dependencies=[Depends(require_admin)],
)
async def disconnect_outlook(session: SessionDep) -> Response:
    await OutlookRepository(session).disconnect()
    logger.info("outlook_disconnected")
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
