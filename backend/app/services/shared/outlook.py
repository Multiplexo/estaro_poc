from base64 import urlsafe_b64encode
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from hashlib import sha256
from typing import Any, cast
from urllib.parse import urlsplit

import httpx
from authlib.integrations.httpx_client import AsyncOAuth2Client
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from cryptography.fernet import Fernet
from kiota_abstractions.api_error import APIError
from kiota_abstractions.authentication import AuthenticationProvider
from kiota_abstractions.request_information import RequestInformation
from kiota_abstractions.serialization import Parsable
from kiota_http.middleware.options import RetryHandlerOption, UrlReplaceHandlerOption
from kiota_serialization_json.json_serialization_writer import JsonSerializationWriter
from msgraph.graph_request_adapter import GraphRequestAdapter
from msgraph.graph_service_client import GraphServiceClient
from msgraph_core import GraphClientFactory
from tenacity import (
    AsyncRetrying,
    RetryCallState,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)

from app.config import Settings
from app.models.domain.outlook import OutlookAccount, OutlookTokens

SCOPES = "offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read"


def retry_outlook_request(exc: BaseException) -> bool:
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
    elif isinstance(exc, APIError):
        status = exc.response_status_code
    else:
        return False
    return status in {408, 429, 500, 502, 503, 504}


def outlook_retry_wait(state: RetryCallState) -> float:
    exc = state.outcome.exception() if state.outcome else None
    if isinstance(exc, httpx.HTTPStatusError):
        headers = exc.response.headers
    elif isinstance(exc, APIError):
        headers = httpx.Headers(exc.response_headers or {})
    else:
        headers = httpx.Headers()
    retry_after = headers.get("Retry-After", "")
    if retry_after.isdigit():
        return float(retry_after)
    return wait_random_exponential(multiplier=1, max=30)(state)


def serialize_graph_model(model: Parsable) -> bytes:
    writer = JsonSerializationWriter()
    writer.write_object_value(None, model)
    return writer.get_serialized_content()


async def check_oauth_response(response: httpx.Response) -> None:
    await response.aread()
    response.raise_for_status()


class OutlookAuthenticationProvider(AuthenticationProvider):
    def __init__(self, oauth: AsyncOAuth2Client) -> None:
        self.oauth = oauth

    async def authenticate_request(
        self,
        request: RequestInformation,
        additional_authentication_context: dict[str, Any] | None = None,
    ) -> None:
        parsed = urlsplit(request.url)
        if (
            parsed.scheme != "https"
            or parsed.netloc != "graph.microsoft.com"
            or not parsed.path.startswith("/v1.0/")
        ):
            raise ValueError("Invalid Microsoft Graph URL")
        if not self.oauth.token or not self.oauth.token.get("access_token"):
            raise ValueError("Microsoft Graph access token unavailable")
        request.headers.add(
            "Authorization", f"Bearer {self.oauth.token['access_token']}"
        )


@asynccontextmanager
async def create_outlook_client(settings: Settings) -> AsyncIterator["OutlookClient"]:
    oauth = AsyncOAuth2Client(
        client_id=settings.MS_CLIENT_ID,
        client_secret=settings.MS_CLIENT_SECRET,
        token_endpoint_auth_method="client_secret_post",
        scope=SCOPES,
        redirect_uri=settings.MS_REDIRECT_URI,
        code_challenge_method="S256",
        timeout=60,
        event_hooks={"response": [check_oauth_response]},
    )
    async with (
        cast(httpx.AsyncClient, oauth),
        httpx.AsyncClient(
            timeout=60,
            headers={
                "Prefer": 'outlook.body-content-type="text", IdType="ImmutableId", odata.maxpagesize=50',
            },
        ) as client,
    ):
        GraphClientFactory.create_with_default_middleware(
            client=client,
            options={
                RetryHandlerOption.get_key(): RetryHandlerOption(should_retry=False),
                UrlReplaceHandlerOption.get_key(): UrlReplaceHandlerOption(
                    enabled=True,
                    replacement_pairs={"/users/me-token-to-replace": "/me"},
                ),
            },
        )
        yield OutlookClient(settings, oauth, client)


class OutlookClient:
    def __init__(
        self, settings: Settings, oauth: AsyncOAuth2Client, client: httpx.AsyncClient
    ) -> None:
        self.settings = settings
        self.oauth = oauth
        self.graph = GraphServiceClient(
            request_adapter=GraphRequestAdapter(
                OutlookAuthenticationProvider(oauth), client=client
            )
        )

    def validate_configuration(self) -> None:
        if not self.settings.MS_CLIENT_ID or not self.settings.MS_CLIENT_SECRET:
            raise ValueError("MS_CLIENT_ID and MS_CLIENT_SECRET must be configured")
        authority = urlsplit(self.settings.MS_AUTHORITY)
        if (
            authority.scheme != "https"
            or authority.netloc != "login.microsoftonline.com"
            or not authority.path.strip("/")
            or authority.query
            or authority.fragment
        ):
            raise ValueError("MS_AUTHORITY must be a Microsoft login authority")

    def authorization_url(self, verifier: str) -> str:
        self.validate_configuration()
        url, _ = self.oauth.create_authorization_url(
            f"{self.settings.MS_AUTHORITY.rstrip('/')}/oauth2/v2.0/authorize",
            state=create_s256_code_challenge(verifier),
            code_verifier=verifier,
            response_mode="query",
            prompt="select_account",
        )
        return url

    def encrypt_token(self, token: str) -> str:
        return self._cipher().encrypt(token.encode()).decode()

    def decrypt_token(self, token: str) -> str:
        return self._cipher().decrypt(token.encode()).decode()

    def _cipher(self) -> Fernet:
        self.validate_configuration()
        key = sha256(
            b"estaro_outlook_tokens\x00" + self.settings.MS_CLIENT_SECRET.encode()
        ).digest()
        return Fernet(urlsafe_b64encode(key))

    async def exchange_code(self, code: str, verifier: str) -> OutlookTokens:
        self.validate_configuration()
        tokens = await self.request(
            lambda: self.oauth.fetch_token(
                f"{self.settings.MS_AUTHORITY.rstrip('/')}/oauth2/v2.0/token",
                grant_type="authorization_code",
                code=code,
                code_verifier=verifier,
            )
        )
        return OutlookTokens.model_validate(tokens)

    async def refresh(self, encrypted_token: str) -> OutlookTokens:
        self.validate_configuration()
        tokens = await self.request(
            lambda: self.oauth.refresh_token(
                f"{self.settings.MS_AUTHORITY.rstrip('/')}/oauth2/v2.0/token",
                refresh_token=self.decrypt_token(encrypted_token),
            )
        )
        return OutlookTokens.model_validate(tokens)

    async def account(self) -> OutlookAccount:
        account = await self.request(self.graph.me.get)
        if account is None or not account.id:
            raise ValueError("Microsoft Graph did not return an account ID")
        return OutlookAccount(id=account.id)

    async def request[Result](
        self, operation: Callable[[], Awaitable[Result]]
    ) -> Result:
        async def execute() -> Result:
            return await operation()

        return await AsyncRetrying(
            retry=retry_if_exception(retry_outlook_request),
            wait=outlook_retry_wait,
            stop=stop_after_attempt(4),
            reraise=True,
        )(execute)
