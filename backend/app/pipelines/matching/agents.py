from collections.abc import Mapping

import structlog
from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy
from langchain_core.utils.function_calling import convert_to_json_schema
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.articles import Article
from app.models.domain.customers import Customer
from app.models.domain.inquiry_data import InquiryData
from app.models.jobs.matching import (
    MatchCandidate,
    MatchDecision,
    MatchResult,
    matching_input,
)
from app.persistence.jobs.matching.memory_repository import MatchingMemoryRepository
from app.pipelines.guardrails import GUARDRAILS_SYSTEM_PROMPT, create_guardrails
from app.pipelines.matching.prompts import ARTICLE_PROMPT, CUSTOMER_PROMPT
from app.pipelines.matching.tools.customer_tools import create_customer_tools
from app.pipelines.matching.tools.position_tools import create_position_tools
from app.services.shared.ai import AIService

logger = structlog.get_logger(__name__)


class MatchingAgents:
    def __init__(
        self,
        sessions: async_sessionmaker[AsyncSession],
        ai_service: AIService,
        memory: MatchingMemoryRepository,
        rules_prompt: str = "",
        *,
        recursion_limit: int,
    ) -> None:
        self.sessions = sessions
        self.ai_service = ai_service
        self.memory = memory
        self.rules_prompt = rules_prompt
        self.recursion_limit = recursion_limit

    async def customer(self, data: InquiryData) -> MatchResult:
        candidates: dict[str, Customer] = {}
        agent = create_agent(
            self.ai_service.get_chat_model(),
            tools=create_customer_tools(self.sessions, self.memory, candidates),
            system_prompt=CUSTOMER_PROMPT
            + self.rules_prompt
            + GUARDRAILS_SYSTEM_PROMPT,
            middleware=create_guardrails(self.ai_service.get_guardrail_model()),
            response_format=ProviderStrategy(
                convert_to_json_schema(MatchDecision, strict=True), strict=True
            ),
            store=self.memory.store,
            name="customer_matching",
        )
        response = await agent.ainvoke(
            {
                "messages": [
                    {"role": "user", "content": matching_input(data, "customer")}
                ]
            },
            {"recursion_limit": self.recursion_limit},
        )
        decision = MatchDecision.model_validate(response["structured_response"])
        result = match_result(
            decision,
            {key: customer_candidate(value) for key, value in candidates.items()},
        )
        return result

    async def article(self, data: InquiryData, position_index: int) -> MatchResult:
        candidates: dict[str, Article] = {}
        agent = create_agent(
            self.ai_service.get_chat_model(),
            tools=create_position_tools(self.sessions, self.memory, candidates),
            system_prompt=ARTICLE_PROMPT + self.rules_prompt + GUARDRAILS_SYSTEM_PROMPT,
            middleware=create_guardrails(self.ai_service.get_guardrail_model()),
            response_format=ProviderStrategy(
                convert_to_json_schema(MatchDecision, strict=True), strict=True
            ),
            store=self.memory.store,
            name="article_matching",
        )
        source = matching_input(data, "article", position_index)
        response = await agent.ainvoke(
            {"messages": [{"role": "user", "content": source}]},
            {"recursion_limit": self.recursion_limit},
        )
        decision = MatchDecision.model_validate(response["structured_response"])
        result = match_result(
            decision,
            {key: article_candidate(value) for key, value in candidates.items()},
        )
        return result


def match_result(
    decision: MatchDecision, candidates: Mapping[str, MatchCandidate]
) -> MatchResult:
    entity_id = resolve_candidate_id(decision.entity_id, candidates)
    resolved_alternatives = [
        resolve_candidate_id(key, candidates) for key in decision.alternative_ids
    ]
    invalid_ids = list(
        dict.fromkeys(
            key
            for key, resolved in zip(
                [decision.entity_id, *decision.alternative_ids],
                [entity_id, *resolved_alternatives],
                strict=True,
            )
            if key is not None and resolved is None
        )
    )
    conflicts = list(decision.conflicts)
    if invalid_ids:
        logger.warning(
            "matching_candidate_reference_invalid",
            invalid_ids=invalid_ids,
            candidate_ids=list(candidates),
        )
        conflicts.append(
            "Vorgeschlagene Kennungen sind in den abgerufenen Stammdaten nicht "
            "eindeutig zuordenbar und wurden verworfen: " + ", ".join(invalid_ids)
        )
    alternative_ids = [
        key
        for key in dict.fromkeys(resolved_alternatives)
        if key is not None and key != entity_id
    ][: 4 if entity_id is not None else 5]
    reason = decision.reason
    if decision.entity_id is not None and entity_id is None:
        reason = (
            "Die vorgeschlagene Zuordnung konnte anhand der abgerufenen Stammdaten "
            "nicht eindeutig bestätigt werden. Bitte manuell zuordnen."
        )
    return MatchResult(
        selected=candidates[entity_id] if entity_id is not None else None,
        alternatives=[candidates[key] for key in alternative_ids],
        confidence=decision.confidence if entity_id is not None else 0,
        reason=reason,
        conflicts=conflicts,
    )


def resolve_candidate_id(
    entity_id: str | None, candidates: Mapping[str, MatchCandidate]
) -> str | None:
    if entity_id is None:
        return None
    if entity_id in candidates:
        return entity_id
    matching_ids = [
        key for key, candidate in candidates.items() if candidate.number == entity_id
    ]
    if len(matching_ids) != 1:
        return None
    return matching_ids[0]


def customer_candidate(customer: Customer) -> MatchCandidate:
    return MatchCandidate(
        entity_id=str(customer.id), number=customer.customer_number, label=customer.name
    )


def article_candidate(article: Article) -> MatchCandidate:
    return MatchCandidate(
        entity_id=str(article.id),
        number=article.article_number,
        label=article.description_1,
        variant=article.variant,
    )
