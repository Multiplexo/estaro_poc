from html import escape
from typing import Annotated

import httpx
import structlog
from fastapi import APIRouter, Cookie, Query, status
from fastapi.responses import HTMLResponse, RedirectResponse

from app.config import Settings, SettingsDep
from app.dependencies import SESSION_COOKIE, AuthServiceDep, CurrentUserDep
from app.models.domain.auth import CurrentUser
from app.services.shared.auth import (
    LOGIN_STATE_MAX_AGE_SECONDS,
    AuthenticationError,
    NoRoleError,
    issue_login_state,
    issue_session,
    new_login_state,
    read_login_state,
    safe_redirect_path,
)

logger = structlog.get_logger(__name__)
router = APIRouter()

LOGIN_COOKIE = "estaro_login"


def _secure(settings: Settings) -> bool:
    return settings.AUTH_REDIRECT_URI.startswith("https://")


def _error_page(message: str, status_code: int) -> HTMLResponse:
    body = (
        '<!doctype html><html lang="de"><meta charset="utf-8">'
        "<title>Anmeldung</title>"
        '<body style="font-family:sans-serif;max-width:32rem;margin:4rem auto">'
        f"<h1>Anmeldung nicht möglich</h1><p>{escape(message)}</p>"
        '<p><a href="login">Erneut anmelden</a></p></body></html>'
    )
    response = HTMLResponse(body, status_code=status_code)
    response.delete_cookie(LOGIN_COOKIE, path="/")
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/login", operation_id="start_login")
async def login(
    settings: SettingsDep,
    auth: AuthServiceDep,
    redirect: Annotated[str | None, Query()] = None,
) -> RedirectResponse:
    redirect_path = safe_redirect_path(redirect)
    if not settings.AUTH_ENABLED:
        return RedirectResponse(
            f"{settings.MS_FRONTEND_URL}{redirect_path}", status_code=302
        )
    login_state = new_login_state(redirect_path)
    try:
        url = await auth.authorization_url(login_state)
    except httpx.HTTPError:
        logger.exception("login_metadata_unavailable")
        raise
    response = RedirectResponse(url, status_code=302)
    response.set_cookie(
        LOGIN_COOKIE,
        issue_login_state(settings, login_state),
        max_age=LOGIN_STATE_MAX_AGE_SECONDS,
        httponly=True,
        secure=_secure(settings),
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/callback", operation_id="finish_login", response_model=None)
async def callback(
    settings: SettingsDep,
    auth: AuthServiceDep,
    code: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    error: Annotated[str | None, Query()] = None,
    login_token: Annotated[str | None, Cookie(alias=LOGIN_COOKIE)] = None,
) -> RedirectResponse | HTMLResponse:
    if error:
        logger.warning("login_rejected_by_identity_provider", error=error)
        return _error_page(
            "Microsoft hat die Anmeldung abgebrochen.", status.HTTP_401_UNAUTHORIZED
        )
    login_state = read_login_state(settings, login_token) if login_token else None
    if login_state is None or not code or state != login_state.state:
        logger.warning("login_state_invalid")
        return _error_page(
            "Die Anmeldung ist abgelaufen oder ungültig.", status.HTTP_400_BAD_REQUEST
        )
    try:
        user = await auth.sign_in(code, login_state)
    except NoRoleError:
        logger.warning("login_without_role")
        return _error_page(
            "Ihrem Konto ist keine Rolle für estaro zugewiesen. "
            "Bitte wenden Sie sich an Ihre IT.",
            status.HTTP_403_FORBIDDEN,
        )
    except (AuthenticationError, httpx.HTTPError):
        logger.exception("login_failed")
        return _error_page(
            "Die Anmeldung konnte nicht abgeschlossen werden.",
            status.HTTP_401_UNAUTHORIZED,
        )

    logger.info("login_succeeded", user_id=user.id, roles=[str(r) for r in user.roles])
    response = RedirectResponse(
        f"{settings.MS_FRONTEND_URL}{login_state.redirect_path}", status_code=303
    )
    response.delete_cookie(LOGIN_COOKIE, path="/")
    response.set_cookie(
        SESSION_COOKIE,
        issue_session(settings, user),
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=_secure(settings),
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@router.get("/me", operation_id="get_current_user")
async def me(user: CurrentUserDep) -> CurrentUser:
    return user


@router.get("/logout", operation_id="logout")
async def logout(settings: SettingsDep, auth: AuthServiceDep) -> RedirectResponse:
    target = f"{settings.MS_FRONTEND_URL}/"
    if settings.AUTH_ENABLED:
        target = await auth.logout_url(target) or target
    response = RedirectResponse(target, status_code=303)
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.headers["Cache-Control"] = "no-store"
    return response
