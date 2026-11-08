from uuid import uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.rules import RuleCategory, RuleCreate, RuleUpdate
from app.persistence.domain.rules.rule_repository import RuleRepository

pytestmark = pytest.mark.integration


async def test_rules_crud_and_filters(db_session: AsyncSession) -> None:
    repository = RuleRepository(db_session)
    rule = await repository.create(
        RuleCreate(
            title="Keep units",
            instruction="Preserve source units",
            category=RuleCategory.EXTRACTION,
        )
    )
    assert [item.id for item in await repository.list_rules(active_only=True)] == [
        rule.id
    ]
    assert await repository.list_rules(category=RuleCategory.MATCHING) == []
    updated = await repository.update(
        rule.id,
        RuleUpdate(
            title="Updated",
            instruction="Prefer exact numbers",
            category=RuleCategory.MATCHING,
            is_active=False,
        ),
    )
    assert updated is not None and updated.title == "Updated"
    assert await repository.list_rules(active_only=True) == []
    assert [
        item.id for item in await repository.list_rules(category=RuleCategory.MATCHING)
    ] == [rule.id]
    assert (
        await repository.update(
            uuid4(),
            RuleUpdate(
                title="Missing",
                instruction="Missing rule",
                category=RuleCategory.EXTRACTION,
            ),
        )
        is None
    )
    assert await repository.delete(rule.id) is True
    assert await repository.delete(rule.id) is False
    assert await repository.list_rules() == []
