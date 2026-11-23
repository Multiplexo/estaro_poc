from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.dependencies import get_rule_service, require_admin
from app.models.domain.rules import Rule, RuleCategory, RuleCreate, RuleUpdate
from app.services.domain.rules import RuleService

router = APIRouter()
ServiceDep = Annotated[RuleService, Depends(get_rule_service)]


@router.get("", operation_id="list_rules")
async def list_rules(
    service: ServiceDep,
    category: RuleCategory | None = None,
    document_id: UUID | None = None,
) -> list[Rule]:
    return await service.list_rules(category=category, document_id=document_id)


@router.post("", status_code=status.HTTP_201_CREATED, operation_id="create_rule")
async def create_rule(data: RuleCreate, service: ServiceDep) -> Rule:
    return await service.create(data)


@router.put("/{rule_id}", operation_id="update_rule")
async def update_rule(rule_id: UUID, data: RuleUpdate, service: ServiceDep) -> Rule:
    return await service.update(rule_id, data)


@router.delete(
    "/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_rule",
    dependencies=[Depends(require_admin)],
)
async def delete_rule(rule_id: UUID, service: ServiceDep) -> Response:
    await service.delete(rule_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
