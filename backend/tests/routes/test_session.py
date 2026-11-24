"""Sign-in flow with Microsoft Entra ID against a local mock identity provider."""

import base64
import hashlib
import socket
import threading
import time
from collections.abc import AsyncIterator, Iterator
from typing import Any
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import pytest
import uvicorn
from fastapi import FastAPI, Form
from fastapi.responses import JSONResponse
from httpx import ASGITransport, AsyncClient
from joserfc import jwt
from joserfc.jwk import RSAKey

from app.config import Settings, get_settings
from app.main import app
from app.services.shared.auth import EntraAuthService

TENANT = "test-tenant"
CLIENT_ID = "estaro-client"
FRONTEND = "http://localhost:5173"


class MockIdentityProvider:
    """Minimal OpenID Connect provider that issues signed ID tokens."""

    def __init__(self, host: str) -> None:
        self.host = host
        self.issuer = f"{host}/{TENANT}/v2.0"
        self.key = RSAKey.generate_key(
            2048, parameters={"kid": "k1", "use": "sig", "alg": "RS256"}
        )
        self.roles: list[str] = ["bearbeiter"]
        self.nonce: str | None = None
        self.nonce_override: str | None = None
        self.challenge: str | None = None
        self.app = self._create_app()

    def _create_app(self) -> FastAPI:
        idp = FastAPI()
        base = f"{self.host}/{TENANT}"

        @idp.get(f"/{TENANT}/v2.0/.well-known/openid-configuration")
        def discovery() -> dict[str, str]:
            return {
                "issuer": self.issuer,
                "authorization_endpoint": f"{base}/oauth2/v2.0/authorize",
                "token_endpoint": f"{base}/oauth2/v2.0/token",
                "jwks_uri": f"{base}/discovery/v2.0/keys",
                "end_session_endpoint": f"{base}/oauth2/v2.0/logout",
            }

        @idp.get(f"/{TENANT}/discovery/v2.0/keys")
        def keys() -> dict[str, Any]:
            return {"keys": [self.key.as_dict(private=False)]}

        @idp.post(f"/{TENANT}/oauth2/v2.0/token")
        def token(
            code: str = Form(), code_verifier: str = Form(), client_id: str = Form()
        ) -> JSONResponse:
            digest = hashlib.sha256(code_verifier.encode()).digest()
            challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
            if challenge != self.challenge or client_id != CLIENT_ID:
                return JSONResponse({"error": "invalid_grant"}, status_code=400)
            now = int(time.time())
            claims = {
                "iss": self.issuer,
                "aud": CLIENT_ID,
                "sub": "sub-1",
                "oid": "oid-1",
                "name": "Tina Test",
                "preferred_username": "tina@example.test",
                "nonce": self.nonce_override or self.nonce,
                "iat": now,
                "exp": now + 600,
                "roles": self.roles,
            }
            id_token = jwt.encode({"alg": "RS256", "kid": "k1"}, claims, self.key)
            return JSONResponse(
                {"access_token": "a", "token_type": "Bearer", "id_token": id_token}
            )

        return idp


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture(scope="module")
def idp() -> Iterator[MockIdentityProvider]:
    port = free_port()
    provider = MockIdentityProvider(f"http://127.0.0.1:{port}")
    server = uvicorn.Server(uvicorn.Config(provider.app, port=port, log_level="error"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.05)
    try:
        yield provider
    finally:
        server.should_exit = True
        thread.join(timeout=5)


@pytest.fixture
def auth_settings(idp: MockIdentityProvider) -> Iterator[Settings]:
    settings = get_settings().model_copy(
        update={
            "AUTH_ENABLED": True,
            "AUTH_TENANT_ID": TENANT,
            "AUTH_CLIENT_ID": CLIENT_ID,
            "AUTH_CLIENT_SECRET": "secret",
            "AUTH_AUTHORITY_HOST": idp.host,
            "AUTH_REDIRECT_URI": f"{FRONTEND}/api/session/callback",
            "SESSION_SECRET": "x" * 40,
            "MS_FRONTEND_URL": FRONTEND,
        }
    )
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_settings] = lambda: settings
    EntraAuthService._cache.clear()
    idp.roles = ["bearbeiter"]
    idp.nonce_override = None
    try:
        yield settings
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        EntraAuthService._cache.clear()


@pytest.fixture
async def browser(auth_settings: Settings) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


async def sign_in(
    client: AsyncClient, idp: MockIdentityProvider, redirect: str = "/anfragen"
) -> tuple[int, str | None]:
    response = await client.get(f"/session/login?redirect={redirect}")
    query = parse_qs(urlsplit(response.headers["location"]).query)
    idp.nonce = query["nonce"][0]
    idp.challenge = query["code_challenge"][0]
    callback = await client.get(f"/session/callback?code=abc&state={query['state'][0]}")
    return callback.status_code, callback.headers.get("location")


async def test_requires_sign_in(browser: AsyncClient) -> None:
    assert (await browser.get("/session/me")).status_code == 401
    assert (await browser.get("/articles")).status_code == 401


async def test_login_redirects_with_pkce(
    browser: AsyncClient, idp: MockIdentityProvider
) -> None:
    response = await browser.get("/session/login?redirect=/anfragen")

    location = response.headers["location"]
    query = parse_qs(urlsplit(location).query)
    assert response.status_code == 302
    assert location.startswith(f"{idp.host}/{TENANT}/oauth2/v2.0/authorize")
    assert query["code_challenge_method"] == ["S256"]
    assert "nonce" in query


async def test_sign_in_roles_and_logout(
    browser: AsyncClient, idp: MockIdentityProvider
) -> None:
    status_code, location = await sign_in(browser, idp)

    assert status_code == 303
    assert location == f"{FRONTEND}/anfragen"
    me = (await browser.get("/session/me")).json()
    assert me["name"] == "Tina Test"
    assert me["roles"] == ["bearbeiter"]
    assert me["is_admin"] is False
    assert (await browser.delete(f"/rules/{uuid4()}")).status_code == 403
    assert (await browser.get("/auth/login")).status_code == 403

    logout = await browser.get("/session/logout")
    assert logout.status_code == 303
    assert logout.headers["location"].startswith(
        f"{idp.host}/{TENANT}/oauth2/v2.0/logout"
    )
    browser.cookies.clear()
    assert (await browser.get("/session/me")).status_code == 401


async def test_admin_role(browser: AsyncClient, idp: MockIdentityProvider) -> None:
    idp.roles = ["admin"]

    await sign_in(browser, idp)

    assert (await browser.get("/session/me")).json()["is_admin"] is True


async def test_user_without_role_gets_no_session(
    browser: AsyncClient, idp: MockIdentityProvider
) -> None:
    idp.roles = []

    status_code, _ = await sign_in(browser, idp)

    assert status_code == 403
    assert not browser.cookies.get("estaro_session")


async def test_wrong_nonce_is_rejected(
    browser: AsyncClient, idp: MockIdentityProvider
) -> None:
    idp.nonce_override = "falscher-nonce"

    status_code, _ = await sign_in(browser, idp)

    assert status_code == 401


async def test_wrong_state_is_rejected(browser: AsyncClient) -> None:
    await browser.get("/session/login")

    response = await browser.get("/session/callback?code=abc&state=manipuliert")

    assert response.status_code == 400


async def test_open_redirect_is_blocked(
    browser: AsyncClient, idp: MockIdentityProvider
) -> None:
    _, location = await sign_in(browser, idp, redirect="//evil.example")

    assert location == f"{FRONTEND}/"


async def test_tampered_cookie_is_rejected(browser: AsyncClient) -> None:
    browser.cookies.set("estaro_session", "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjp7fX0.abc")

    assert (await browser.get("/session/me")).status_code == 401
