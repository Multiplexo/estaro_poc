from collections.abc import Mapping

from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy
from langchain_core.utils.function_calling import convert_to_json_schema
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.articles import Article
from app.models.domain.customers import Customer
from app.models.domain.inquiry_data import InquiryData, InquiryPosition
from app.models.jobs.matching import (
    ArticleMatchingInput,
    MatchCandidate,
    MatchDecision,
    MatchResult,
    matching_input,
)
from app.persistence.jobs.matching.memory_repository import MatchingMemoryRepository
from app.pipelines.matching.prompts import ARTICLE_PROMPT, CUSTOMER_PROMPT
from app.pipelines.matching.tools.customer_tools import create_customer_tools
from app.pipelines.matching.tools.position_tools import create_position_tools
from app.services.shared.openai import OpenAIService


class MatchingAgents:
    def __init__(
        self,
        sessions: async_sessionmaker[AsyncSession],
        openai: OpenAIService,
        memory: MatchingMemoryRepository,
        rules_prompt: str = "",
    ) -> None:
        self.sessions = sessions
        self.openai = openai
        self.memory = memory
        self.rules_prompt = rules_prompt

    async def customer(self, data: InquiryData) -> MatchResult:
        candidates: dict[str, Customer] = {}
        agent = create_agent(
            self.openai.get_chat_model(),
            tools=create_customer_tools(self.sessions, self.memory, candidates),
            system_prompt=CUSTOMER_PROMPT + self.rules_prompt,
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
            {"recursion_limit": 30},
        )
        decision = MatchDecision.model_validate(response["structured_response"])
        return match_result(
            decision,
            {key: customer_candidate(value) for key, value in candidates.items()},
        )

    async def article(
        self, position: InquiryPosition, header: str | None = None
    ) -> MatchResult:
        candidates: dict[str, Article] = {}
        agent = create_agent(
            self.openai.get_chat_model(),
            tools=create_position_tools(self.sessions, self.memory, candidates),
            system_prompt=ARTICLE_PROMPT + self.rules_prompt,
            response_format=ProviderStrategy(
                convert_to_json_schema(MatchDecision, strict=True), strict=True
            ),
            store=self.memory.store,
            name="article_matching",
        )
        source = ArticleMatchingInput(
            position=position, kopftext=header
        ).model_dump_json(exclude_none=True)
        response = await agent.ainvoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": source,
                    }
                ]
            },
            {"recursion_limit": 30},
        )
        decision = MatchDecision.model_validate(response["structured_response"])
        return match_result(
            decision,
            {key: article_candidate(value) for key, value in candidates.items()},
        )


def match_result(
    decision: MatchDecision, candidates: Mapping[str, MatchCandidate]
) -> MatchResult:
    alternative_ids = [
        key
        for key in dict.fromkeys(decision.alternative_ids)
        if key != decision.entity_id
    ][: 4 if decision.entity_id else 5]
    for entity_id in [decision.entity_id, *alternative_ids]:
        if entity_id is None:
            continue
        if entity_id not in candidates:
            raise ValueError(
                "Zuordnungen müssen auf mit Werkzeugen abgerufene Stammdaten verweisen"
            )
    return MatchResult(
        selected=candidates[decision.entity_id] if decision.entity_id else None,
        alternatives=[candidates[key] for key in alternative_ids],
        confidence=decision.confidence if decision.entity_id else 0,
        reason=decision.reason,
        conflicts=decision.conflicts,
    )


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
