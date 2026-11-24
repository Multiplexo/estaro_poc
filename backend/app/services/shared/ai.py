from collections import deque
from types import TracebackType
from typing import Self

import openai
import structlog
from fastapi.concurrency import run_in_threadpool
from langchain_openai import ChatOpenAI
from openai import AsyncOpenAI
from pydantic import SecretStr

from app.config import Settings

logger = structlog.get_logger(__name__)

MAX_PROVIDER_DETAIL_LENGTH = 300


class AIService:
    def __init__(self, settings: Settings) -> None:
        if not settings.API_KEY:
            raise ValueError("API_KEY must be configured")
        self._api_key = SecretStr(settings.API_KEY)
        self._model_name = settings.MODEL
        self._base_url = settings.LLM_BASE_URL or None
        self._timeout = 120.0
        # The SDK retries rate limits and transient errors and honors Retry-After.
        self._max_retries = settings.LLM_MAX_RETRIES
        self._chat_model: ChatOpenAI | None = None
        self.client = AsyncOpenAI(
            api_key=self._api_key.get_secret_value(),
            base_url=self._base_url,
            timeout=self._timeout,
            max_retries=self._max_retries,
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        await self.close()

    async def close(self) -> None:
        try:
            try:
                if self._chat_model is not None:
                    await run_in_threadpool(self._chat_model.root_client.close)
            finally:
                await self.client.close()
        except Exception:
            logger.exception("ai_client_close_failed")
            raise

    def get_chat_model(self) -> ChatOpenAI:
        if self._chat_model is None:
            self._chat_model = ChatOpenAI(
                model=self._model_name,
                api_key=self._api_key,
                base_url=self._base_url,
                root_async_client=self.client,
                async_client=self.client.chat.completions,
                use_responses_api=True,
                max_retries=self._max_retries,
                timeout=self._timeout,
            )
        return self._chat_model


def _find_provider_error(error: BaseException) -> openai.APIError | None:
    """Search the exception, its causes and exception groups for a provider error."""
    pending: deque[BaseException] = deque([error])
    seen: set[int] = set()
    while pending:
        current = pending.popleft()
        if id(current) in seen:
            continue
        seen.add(id(current))
        if isinstance(current, openai.APIError):
            return current
        if isinstance(current, BaseExceptionGroup):
            pending.extend(current.exceptions)
        if current.__cause__ is not None:
            pending.append(current.__cause__)
        if current.__context__ is not None:
            pending.append(current.__context__)
    return None


def describe_ai_error(error: BaseException, model: str) -> str | None:
    """Return a German message for users when a job failed at the AI provider."""
    provider_error = _find_provider_error(error)
    if provider_error is None:
        return None
    detail = provider_error.message[:MAX_PROVIDER_DETAIL_LENGTH]
    if isinstance(provider_error, openai.RateLimitError):
        return (
            "KI-Anbieter: Limit oder Kontingent erreicht (HTTP 429). "
            f"Meldung des Anbieters: {detail}"
        )
    if isinstance(provider_error, openai.AuthenticationError):
        return "KI-Anbieter: API-Key ungültig oder nicht gesetzt (HTTP 401)."
    if isinstance(provider_error, openai.PermissionDeniedError):
        return f"KI-Anbieter: Zugriff verweigert (HTTP 403). Meldung: {detail}"
    if isinstance(provider_error, openai.NotFoundError):
        return f"KI-Anbieter: Modell „{model}“ oder Endpunkt nicht gefunden (HTTP 404)."
    if isinstance(provider_error, openai.APITimeoutError):
        return "KI-Anbieter: Zeitüberschreitung bei der Antwort."
    if isinstance(provider_error, openai.APIConnectionError):
        return "KI-Anbieter nicht erreichbar (Netzwerk oder Adresse prüfen)."
    if isinstance(provider_error, openai.APIStatusError):
        return (
            f"KI-Anbieter meldet einen Fehler (HTTP {provider_error.status_code}). "
            f"Meldung: {detail}"
        )
    return f"KI-Anbieter meldet einen Fehler: {detail}"
