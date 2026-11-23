"""Sign-in with Microsoft Entra ID (OpenID Connect, authorization code + PKCE).

The backend handles the whole flow. The browser only receives an HTTP-only session
cookie that holds a signed, short-lived token with the user's ID, name and roles.
"""

import time
from secrets import token_urlsafe
from typing import Any, ClassVar, cast

import httpx
import structlog
from authlib.integrations.httpx_client import AsyncOAuth2Client
from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import KeySet, KeySetSerialization, OctKey
from pydantic import ValidationError

from app.config import Settings
from app.models.domain.auth import CurrentUser, LoginState, UserRole

logger = structlog.get_logger(__name__)

SESSION_ISSUER = "estaro"
SESSION_ALGORITHM = "HS256"
LOGIN_STATE_MAX_AGE_SECONDS = 600
METADATA_TTL_SECONDS = 3600
OIDC_SCOPES = "openid profile email"
HTTP_TIMEOUT_SECONDS = 15


class AuthenticationError(Exception):
    """Sign-in failed; the message is safe to log, not to show in detail."""


class NoRoleError(AuthenticationError):
    """The user signed in but has no estaro role assigned."""


def _session_key(settings: Settings) -> OctKey:
    return OctKey.import_key(settings.SESSION_SECRET)


def _sign(settings: Settings, claims: dict[str, Any], max_age: int) -> str:
    now = int(time.time())
    payload = {"iss": SESSION_ISSUER, "iat": now, "exp": now + max_age, **claims}
    return jwt.encode({"alg": SESSION_ALGORITHM}, payload, _session_key(settings))


def _verify(settings: Settings, token: str) -> dict[str, Any] | None:
    try:
        decoded = jwt.decode(token, _session_key(settings), [SESSION_ALGORITHM])
        jwt.JWTClaimsRegistry(
            iss={"essential": True, "value": SESSION_ISSUER},
            exp={"essential": True},
        ).validate(decoded.claims)
    except (JoseError, ValueError):
        return None
    return decoded.claims


def issue_session(settings: Settings, user: CurrentUser) -> str:
    return _sign(
        settings,
        {"user": user.model_dump(exclude={"is_admin"}, mode="json")},
        settings.SESSION_MAX_AGE_SECONDS,
    )


def read_session(settings: Settings, token: str) -> CurrentUser | None:
    claims = _verify(settings, token)
    if claims is None:
        return None
    try:
        return CurrentUser.model_validate(claims.get("user"))
    except ValidationError:
        return None


def new_login_state(redirect_path: str) -> LoginState:
    return LoginState(
        state=token_urlsafe(32),
        nonce=token_urlsafe(32),
        verifier=token_urlsafe(64),
        redirect_path=redirect_path,
    )


def issue_login_state(settings: Settings, login: LoginState) -> str:
    return _sign(
        settings, {"login": login.model_dump(mode="json")}, LOGIN_STATE_MAX_AGE_SECONDS
    )


def read_login_state(settings: Settings, token: str) -> LoginState | None:
    claims = _verify(settings, token)
    if claims is None:
        return None
    try:
        return LoginState.model_validate(claims.get("login"))
    except ValidationError:
        return None


def safe_redirect_path(path: str | None) -> str:
    """Allow only local paths so the login cannot redirect to other sites."""
    if not path or not path.startswith("/") or path.startswith("//") or "\\" in path:
        return "/"
    return path


def roles_from_claims(settings: Settings, claims: dict[str, Any]) -> list[UserRole]:
    mapping = {
        settings.AUTH_ADMIN_ROLE: UserRole.ADMIN,
        settings.AUTH_USER_ROLE: UserRole.USER,
    }
    raw_roles = claims.get("roles") or []
    return list(dict.fromkeys(mapping[role] for role in raw_roles if role in mapping))


class EntraAuthService:
    # Discovery documents and signing keys; only successful responses are cached.
    _cache: ClassVar[dict[str, tuple[float, dict[str, Any]]]] = {}

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.settings = settings
        self.client = client

    @property
    def authority(self) -> str:
        host = self.settings.AUTH_AUTHORITY_HOST.rstrip("/")
        return f"{host}/{self.settings.AUTH_TENANT_ID}/v2.0"

    async def _get_json(self, url: str) -> dict[str, Any]:
        cached = self._cache.get(url)
        if cached is not None and time.monotonic() - cached[0] < METADATA_TTL_SECONDS:
            return cached[1]
        response = await self.client.get(url, timeout=HTTP_TIMEOUT_SECONDS)
        response.raise_for_status()
        document = response.json()
        self._cache[url] = (time.monotonic(), document)
        return document

    async def metadata(self) -> dict[str, Any]:
        return await self._get_json(
            f"{self.authority}/.well-known/openid-configuration"
        )

    def _oauth(self) -> AsyncOAuth2Client:
        return AsyncOAuth2Client(
            client_id=self.settings.AUTH_CLIENT_ID,
            client_secret=self.settings.AUTH_CLIENT_SECRET,
            token_endpoint_auth_method="client_secret_post",
            scope=OIDC_SCOPES,
            redirect_uri=self.settings.AUTH_REDIRECT_URI,
            code_challenge_method="S256",
            timeout=HTTP_TIMEOUT_SECONDS,
        )

    async def authorization_url(self, login: LoginState) -> str:
        metadata = await self.metadata()
        oauth = self._oauth()
        async with cast(httpx.AsyncClient, oauth):
            url, _ = oauth.create_authorization_url(
                metadata["authorization_endpoint"],
                state=login.state,
                nonce=login.nonce,
                code_verifier=login.verifier,
                response_mode="query",
            )
        return url

    async def sign_in(self, code: str, login: LoginState) -> CurrentUser:
        metadata = await self.metadata()
        oauth = self._oauth()
        async with cast(httpx.AsyncClient, oauth):
            try:
                token = await oauth.fetch_token(
                    metadata["token_endpoint"],
                    grant_type="authorization_code",
                    code=code,
                    code_verifier=login.verifier,
                )
            except Exception as error:
                raise AuthenticationError("Token exchange failed") from error
        id_token = token.get("id_token")
        if not isinstance(id_token, str):
            raise AuthenticationError("Token response has no ID token")
        claims = await self.validate_id_token(id_token, login.nonce, metadata)
        roles = roles_from_claims(self.settings, claims)
        if not roles:
            raise NoRoleError("User has no estaro role")
        return CurrentUser(
            id=str(claims.get("oid") or claims["sub"]),
            name=str(claims.get("name") or claims.get("preferred_username") or ""),
            email=claims.get("email") or claims.get("preferred_username"),
            roles=roles,
        )

    async def validate_id_token(
        self, id_token: str, nonce: str, metadata: dict[str, Any]
    ) -> dict[str, Any]:
        jwks = await self._get_json(metadata["jwks_uri"])
        keys = KeySet.import_key_set(cast(KeySetSerialization, jwks))
        try:
            decoded = jwt.decode(id_token, keys, ["RS256"])
            jwt.JWTClaimsRegistry(
                iss={"essential": True, "value": metadata["issuer"]},
                aud={"essential": True, "value": self.settings.AUTH_CLIENT_ID},
                nonce={"essential": True, "value": nonce},
                exp={"essential": True},
                sub={"essential": True},
            ).validate(decoded.claims)
        except (JoseError, ValueError) as error:
            raise AuthenticationError("ID token is invalid") from error
        return decoded.claims

    async def logout_url(self, post_logout_redirect: str) -> str | None:
        try:
            metadata = await self.metadata()
        except httpx.HTTPError:
            logger.exception("auth_metadata_unavailable_on_logout")
            return None
        endpoint = metadata.get("end_session_endpoint")
        if not endpoint:
            return None
        return str(
            httpx.URL(
                endpoint, params={"post_logout_redirect_uri": post_logout_redirect}
            )
        )
