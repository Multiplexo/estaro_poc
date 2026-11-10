import hashlib
import json
import re
from collections.abc import AsyncIterator
from uuid import NAMESPACE_URL, UUID, uuid5

import structlog
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.inquiries import InquiryExtractionSnapshot
from app.models.domain.inquiry_data import InquiryData
from app.models.domain.inquiry_mapping import map_extraction_to_inquiry
from app.models.jobs.agent_memory import ExtractionFeedback
from app.models.jobs.extraction import extraction_fields
from app.models.jobs.matching import MatchCategory, MatchFeedback, matching_input
from app.persistence.domain.inquiries.schema.inquiry import Inquiry
from app.persistence.domain.inquiries.schema.inquiry_extraction import InquiryExtraction

logger = structlog.get_logger(__name__)

FIELD_PATHS = {
    "customer": "kundeninformationen.name",
    "customer_number": "kundeninformationen.kunde",
    "customer_location": "kundeninformationen.ort.stadt",
}
POSITION_PATHS = {
    "article": "bezeichnung",
    "material": "bezeichnung2",
    "unit": "mengeneinheit",
}


def extraction_feedback(
    snapshot: InquiryExtractionSnapshot, data: InquiryData
) -> ExtractionFeedback | None:
    if snapshot.job_id is None:
        return None
    fields: dict[str, str | None] = {}
    sources: dict[str, object] = {}
    for name, original in extraction_fields(snapshot.result):
        reviewed = snapshot.review.fields.get(name)
        if reviewed is None or not reviewed.confirmed:
            continue
        path = FIELD_PATHS.get(name)
        if name.startswith("item-"):
            _, index, field = name.split("-", 2)
            if field in POSITION_PATHS:
                path = f"positionen.{index}.{POSITION_PATHS[field]}"
        if path in data.matching_provenance:
            continue
        fields[name] = reviewed.value
        sources[name] = {
            "original_value": original.value,
            "quotes": [citation.quote for citation in original.citations],
        }
    if not fields:
        return None
    return ExtractionFeedback(
        id=snapshot.id,
        job_id=snapshot.job_id,
        source_input=json.dumps(sources, ensure_ascii=False),
        confirmed_fields=fields,
        created_at=snapshot.review.updated_at or snapshot.created_at,
    )


def matching_feedback(
    snapshot: InquiryExtractionSnapshot, data: InquiryData, category: MatchCategory
) -> list[MatchFeedback]:
    if snapshot.job_id is None:
        return []
    records: list[MatchFeedback] = []
    original_data = map_extraction_to_inquiry(snapshot.result)
    for path, match in data.matching_provenance.items():
        if match.category != category:
            continue
        position_index = None
        if category == "customer":
            if path != "kundeninformationen.kunde":
                continue
            field_id = "customer_number"
        else:
            parts = path.split(".")
            if len(parts) != 3 or parts[0] != "positionen" or parts[2] != "artikel":
                continue
            position_index = int(parts[1])
            field_id = f"data:{path}"
        reviewed = snapshot.review.fields.get(field_id) or snapshot.review.fields.get(
            f"data:{path}"
        )
        if reviewed is None or not reviewed.confirmed or reviewed.value != match.value:
            continue
        source_input = matching_input(original_data, category, position_index)
        if source_input == "{}":
            continue
        normalized = json.dumps(
            json.loads(source_input), sort_keys=True, ensure_ascii=False
        ).casefold()
        records.append(
            MatchFeedback(
                id=uuid5(NAMESPACE_URL, f"review:{snapshot.id}:{path}"),
                job_id=snapshot.job_id,
                category=category,
                position_index=position_index,
                input_key=hashlib.sha256(normalized.encode()).hexdigest(),
                source_input=source_input,
                entity_id=match.entity_id,
                proposed_entity_id=None,
                note="Aus gespeicherter, bestätigter Zuordnung",
                reuse_for_matching=True,
                created_at=snapshot.review.updated_at or snapshot.created_at,
            )
        )
    return records


class ReviewedMemoryRepository:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def records(
        self,
        category: MatchCategory | None = None,
        exclude_inquiry_id: UUID | None = None,
    ) -> AsyncIterator[ExtractionFeedback | MatchFeedback]:
        latest_id = (
            select(InquiryExtraction.id)
            .where(InquiryExtraction.inquiry_id == Inquiry.id)
            .order_by(
                col(InquiryExtraction.created_at).desc(),
                col(InquiryExtraction.id).desc(),
            )
            .limit(1)
            .correlate(Inquiry)
            .scalar_subquery()
        )
        statement = (
            select(InquiryExtraction, Inquiry.daten)
            .join(Inquiry, col(InquiryExtraction.id) == latest_id)
            .where(
                col(Inquiry.deletion_requested_at).is_(None),
                col(InquiryExtraction.review)["revision"].as_integer() > 0,
            )
            .order_by(
                col(InquiryExtraction.review)["updated_at"].as_string().desc(),
                col(InquiryExtraction.id).desc(),
            )
        )
        if exclude_inquiry_id is not None:
            statement = statement.where(Inquiry.id != exclude_inquiry_id)
        try:
            offset = 0
            while True:
                async with self.sessions() as session:
                    rows = (
                        await session.exec(statement.limit(100).offset(offset))
                    ).all()
                for snapshot, payload in rows:
                    source = snapshot.to_model()
                    data = InquiryData.model_validate(payload)
                    if category is not None:
                        for feedback in matching_feedback(source, data, category):
                            yield feedback
                        continue
                    feedback = extraction_feedback(source, data)
                    if feedback is not None:
                        yield feedback
                if len(rows) < 100:
                    return
                offset += len(rows)
        except SQLAlchemyError:
            logger.exception("reviewed_memory_read_failed", category=category)
            raise

    async def search_extraction(
        self, query: str, exclude_inquiry_id: UUID, limit: int = 5
    ) -> list[ExtractionFeedback]:
        if not 1 <= limit <= 20:
            raise ValueError("Extraction memory limit must be between 1 and 20")
        terms = set(re.findall(r"\w{3,}", query.casefold()))
        if not terms:
            return []
        ranked: list[tuple[int, ExtractionFeedback]] = []
        async for record in self.records(exclude_inquiry_id=exclude_inquiry_id):
            if not isinstance(record, ExtractionFeedback):
                continue
            sources = json.loads(record.source_input)
            text = " ".join(
                str(value)
                for source in sources.values()
                for value in [source["original_value"], *source["quotes"]]
                if value
            )
            source_terms = set(re.findall(r"\w{3,}", text.casefold()))
            score = len(terms & source_terms)
            if score:
                ranked.append((score, record))
                ranked.sort(
                    key=lambda item: (item[0], item[1].created_at), reverse=True
                )
                del ranked[limit:]
        return [record for _, record in ranked]
