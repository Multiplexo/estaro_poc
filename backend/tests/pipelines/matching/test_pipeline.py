from typing import Any
from unittest.mock import Mock
from uuid import uuid4

import pytest
from langgraph.store.memory import InMemoryStore
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.domain.inquiry_data import (
    InquiryData,
    InquiryPosition,
    Kundeninformationen,
)
from app.models.jobs.matching import MatchDecision
from app.persistence.jobs.matching.memory_repository import MatchingMemoryRepository
from app.persistence.jobs.matching.schema.matching_job import MatchingJob
from app.pipelines.matching.agents import MatchingAgents
from app.pipelines.matching.pipeline import run_matching_pipeline

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("position_count", [0, 2])
async def test_matching_agents_use_feedback_tools_and_preserve_source_conflicts(
    ai_service: Mock,
    model_responses: dict[str, dict[str, Any]],
    model_requests: list[dict[str, Any]],
    position_count: int,
) -> None:
    model_responses["MatchDecision"] = MatchDecision(
        confidence=0,
        reason="No confirmed candidate found.",
        conflicts=["requirements"],
    ).model_dump(mode="json")
    data = InquiryData(
        kundeninformationen=Kundeninformationen(name="Acme"),
        positionen=[
            InquiryPosition(bezeichnung=f"Steel {index}")
            for index in range(position_count)
        ],
    )
    job = MatchingJob(
        extraction_job_id=uuid4(),
        inquiry_id=uuid4(),
        input_data=data.model_dump(mode="json"),
        source_conflicts=[
            "customer",
            "customer",
            "contact_email",
            "item-0-quantity",
            "requirements",
        ],
    ).to_model()
    sessions = Mock(spec=async_sessionmaker)
    agents = MatchingAgents(
        sessions,
        ai_service,
        MatchingMemoryRepository(InMemoryStore()),
        recursion_limit=30,
    )

    result = await run_matching_pipeline(job, agents, concurrency=1)

    assert result.customer.selected is None
    assert result.customer.requires_review is True
    assert result.customer.conflicts == ["requirements", "customer", "contact_email"]
    assert [article.position_index for article in result.articles] == list(
        range(position_count)
    )
    for index, article in enumerate(result.articles):
        assert article.selected is None
        assert article.conflicts == (
            ["requirements", "item-0-quantity"] if index == 0 else ["requirements"]
        )
    tool_messages = [
        message
        for request in model_requests
        if request["response_format"]["json_schema"]["name"] == "MatchDecision"
        for message in request["messages"]
        if message["role"] == "tool"
    ]
    assert len(tool_messages) == position_count + 1
    assert all(message["content"] == "[]" for message in tool_messages)
    sessions.assert_not_called()


async def test_matching_rejects_invalid_concurrency_before_ai_calls(
    ai_service: Mock,
) -> None:
    job = MatchingJob(
        extraction_job_id=uuid4(), inquiry_id=uuid4(), input_data={}
    ).to_model()
    agents = MatchingAgents(
        Mock(spec=async_sessionmaker),
        ai_service,
        MatchingMemoryRepository(InMemoryStore()),
        recursion_limit=30,
    )
    with pytest.raises(ValueError, match="Matching concurrency must be positive"):
        await run_matching_pipeline(job, agents, concurrency=0)
    ai_service.get_chat_model.assert_not_called()


async def test_matching_rejects_candidates_not_retrieved_by_tools(
    ai_service: Mock, model_responses: dict[str, dict[str, Any]]
) -> None:
    model_responses["MatchDecision"] = MatchDecision(
        entity_id=str(uuid4()), confidence=0.9, reason="Invented candidate."
    ).model_dump(mode="json")
    job = MatchingJob(
        extraction_job_id=uuid4(), inquiry_id=uuid4(), input_data={}
    ).to_model()
    agents = MatchingAgents(
        Mock(spec=async_sessionmaker),
        ai_service,
        MatchingMemoryRepository(InMemoryStore()),
        recursion_limit=30,
    )

    result = await run_matching_pipeline(job, agents, concurrency=1)

    assert result.customer.selected is None
    assert result.customer.confidence == 0
    assert result.customer.requires_review is True
    assert any(
        "nicht eindeutig zuordenbar" in conflict
        for conflict in result.customer.conflicts
    )
