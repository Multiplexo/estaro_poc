from datetime import UTC, datetime
from uuid import uuid4

from httpx import AsyncClient

from app.dependencies import get_rule_service
from app.models.domain.rules import Rule, RuleCategory
from app.services.domain.rules import RuleService
from tests.types import OverrideDependency


async def test_rules_create_update_delete(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    service = override_dependency(get_rule_service, RuleService)
    payload = {
        "title": "Keep units",
        "instruction": "Preserve source units",
        "category": "extraction",
    }
    rule = Rule(
        **payload,
        id=uuid4(),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    service.create.return_value = rule
    service.update.return_value = rule
    response = await client.post("/rules", json=payload)
    assert response.status_code == 201
    assert response.json() == rule.model_dump(mode="json")
    assert service.create.await_args.args[0].title == payload["title"]
    response = await client.put(f"/rules/{rule.id}", json=payload)
    assert response.status_code == 200
    assert service.update.await_args.args[0] == rule.id
    response = await client.delete(f"/rules/{rule.id}")
    assert response.status_code == 204
    assert response.content == b""
    service.delete.assert_awaited_once_with(rule.id)


async def test_rules_filters_and_validation(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    service = override_dependency(get_rule_service, RuleService)
    service.list_rules.return_value = []
    document_id = uuid4()
    response = await client.get(f"/rules?category=matching&document_id={document_id}")
    assert response.status_code == 200
    assert response.json() == []
    service.list_rules.assert_awaited_once_with(
        category=RuleCategory.MATCHING, document_id=document_id
    )
    response = await client.post(
        "/rules", json={"title": " ", "instruction": "Test", "category": "extraction"}
    )
    assert response.status_code == 422
    service.create.assert_not_awaited()
