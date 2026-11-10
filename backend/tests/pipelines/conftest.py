import json
from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import Mock

import pytest
from httpx import AsyncClient, MockTransport, Request, Response
from langchain_openai import ChatOpenAI

from app.services.shared.ai import AIService


@pytest.fixture
def model_responses() -> dict[str, dict[str, Any]]:
    return {}


@pytest.fixture
def model_requests() -> list[dict[str, Any]]:
    return []


@pytest.fixture
async def ai_service(
    model_responses: dict[str, dict[str, Any]],
    model_requests: list[dict[str, Any]],
) -> AsyncIterator[Mock]:
    async def respond(request: Request) -> Response:
        payload = json.loads(request.content)
        model_requests.append(payload)
        schema = payload["response_format"]["json_schema"]["name"]
        if schema == "InjectionDecision":
            content = {"prompt_injection": False}
        else:
            content = model_responses[schema]
        message: dict[str, Any] = {"role": "assistant", "content": json.dumps(content)}
        if schema == "MatchDecision" and not any(
            item["role"] == "tool" for item in payload["messages"]
        ):
            tools = {item["function"]["name"] for item in payload["tools"]}
            tool = (
                "get_customer_feedback"
                if "get_customer_feedback" in tools
                else "get_position_feedback"
            )
            message = {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "feedback_lookup",
                        "type": "function",
                        "function": {
                            "name": tool,
                            "arguments": '{"query":"Acme steel"}',
                        },
                    }
                ],
            }
        return Response(
            200,
            json={
                "id": "test-completion",
                "object": "chat.completion",
                "created": 0,
                "model": "gpt-4o",
                "choices": [
                    {
                        "index": 0,
                        "message": message,
                        "finish_reason": "tool_calls"
                        if "tool_calls" in message
                        else "stop",
                    }
                ],
            },
        )

    async with AsyncClient(transport=MockTransport(respond)) as client:
        model = ChatOpenAI(
            model="gpt-4o",
            api_key="test-only-key",
            base_url="https://openai.test/v1",
            http_async_client=client,
            use_responses_api=False,
            max_retries=0,
        )
        service = Mock(spec=AIService)
        service.get_chat_model.return_value = model
        yield service
