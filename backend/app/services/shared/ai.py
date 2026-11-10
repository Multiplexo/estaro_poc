from types import TracebackType
from typing import Self

import structlog
from fastapi.concurrency import run_in_threadpool
from langchain_openai import ChatOpenAI
from openai import AsyncOpenAI
from pydantic import SecretStr

from app.config import Settings

logger = structlog.get_logger(__name__)


class AIService:
    def __init__(self, settings: Settings) -> None:
        if not settings.API_KEY:
            raise ValueError("API_KEY must be configured")
        self._api_key = SecretStr(settings.API_KEY)
        self._model_name = settings.MODEL
        self._timeout = 120.0
        self._max_retries = 0
        self._chat_model: ChatOpenAI | None = None
        self.client = AsyncOpenAI(
            api_key=self._api_key.get_secret_value(),
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
                root_async_client=self.client,
                async_client=self.client.chat.completions,
                use_responses_api=True,
                max_retries=self._max_retries,
                timeout=self._timeout,
            )
        return self._chat_model
