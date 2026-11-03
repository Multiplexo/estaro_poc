from uuid import UUID

import structlog
from fastapi import HTTPException

from app.models.domain.inquiries import FileType
from app.models.domain.rules import (
    Rule,
    RuleCategory,
    RuleCreate,
    RuleSource,
    RuleUpdate,
)
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository
from app.persistence.domain.rules.rule_repository import RuleRepository
from app.pipelines.rules import rule_prompt
from app.services.shared.transactions import TransactionService

logger = structlog.get_logger(__name__)


class RuleService:
    def __init__(
        self,
        repository: RuleRepository,
        inquiries: InquiryRepository,
        transactions: TransactionService,
    ) -> None:
        self.repository = repository
        self.inquiries = inquiries
        self.transactions = transactions

    async def list_rules(
        self, category: RuleCategory | None = None, document_id: UUID | None = None
    ) -> list[Rule]:
        return await self.repository.list_rules(
            category=category, document_id=document_id
        )

    async def prompt(self, category: RuleCategory) -> str:
        async with self.transactions.atomic():
            rules = await self.repository.list_rules(
                category=category, active_only=True
            )
        return rule_prompt(rules)

    async def _validate_source(self, source: RuleSource) -> None:
        if source.document_id is None or source.inquiry_id is None:
            raise HTTPException(
                status_code=422,
                detail="Die Markierung benötigt eine Anfrage und ein Dokument.",
            )
        inquiry = await self.inquiries.get_record(source.inquiry_id, for_update=True)
        if inquiry is None or inquiry.deletion_requested_at is not None:
            raise HTTPException(status_code=409, detail="Die Anfrage wird gelöscht.")
        document = await self.inquiries.get_document(source.document_id)
        if document is None or document.inquiry_id != source.inquiry_id:
            raise HTTPException(status_code=404, detail="Dokument nicht gefunden.")
        if document.file_type != FileType.PDF:
            raise HTTPException(
                status_code=422,
                detail="Markierungen sind nur in PDF-Dokumenten möglich.",
            )

    async def create(self, data: RuleCreate) -> Rule:
        async with self.transactions.atomic():
            if data.source is not None:
                await self._validate_source(data.source)
            result = await self.repository.create(data)
        logger.info("rule_created", rule_id=str(result.id), category=result.category)
        return result

    async def update(self, rule_id: UUID, data: RuleUpdate) -> Rule:
        async with self.transactions.atomic():
            rule = await self.repository.update(rule_id, data)
            if rule is None:
                raise HTTPException(status_code=404, detail="Regel nicht gefunden.")
        logger.info("rule_updated", rule_id=str(rule_id), is_active=rule.is_active)
        return rule

    async def delete(self, rule_id: UUID) -> None:
        async with self.transactions.atomic():
            if not await self.repository.delete(rule_id):
                raise HTTPException(status_code=404, detail="Regel nicht gefunden.")
        logger.info("rule_deleted", rule_id=str(rule_id))
