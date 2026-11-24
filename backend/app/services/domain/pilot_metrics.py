"""Pilot key figures from completed reviews.

A correction is a reviewed value that differs from the AI's value, or a customer
or article that was assigned manually instead of accepted from matching.
"""

import re
from collections import Counter, defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.models.domain.pilot_metrics import (
    CostMetrics,
    FieldCorrections,
    FieldGroup,
    PilotMetrics,
    ReviewedInquiry,
    WeeklyCosts,
    WeeklyMetrics,
)
from app.models.jobs.extraction import CUSTOMER_FIELD_NAMES, extraction_fields

POSITION_FIELD = re.compile(r"^item-\d+-(?P<name>.+)$")
POSITION_PATH = re.compile(r"^positionen\.(?P<index>\d+)\.")


@dataclass(frozen=True)
class InquiryOutcome:
    week: str
    corrected_fields: list[tuple[FieldGroup, str]]
    reviewed_fields: list[tuple[FieldGroup, str]]
    customer_reassigned: bool
    positions: int
    articles_reassigned: int

    @property
    def corrections(self) -> int:
        return (
            len(self.corrected_fields)
            + int(self.customer_reassigned)
            + self.articles_reassigned
        )


def _same(left: str | None, right: str | None) -> bool:
    return " ".join((left or "").split()) == " ".join((right or "").split())


def _group(field_id: str) -> tuple[FieldGroup, str]:
    position = POSITION_FIELD.match(field_id)
    if position:
        return "position", position.group("name")
    if field_id in CUSTOMER_FIELD_NAMES:
        return "customer", field_id
    return "inquiry", field_id


def evaluate(item: ReviewedInquiry) -> InquiryOutcome | None:
    """Return the outcome of a completed review, or None if it is not complete."""
    fields = list(extraction_fields(item.extraction))
    reviewed = item.review.fields
    if not fields or not all(
        name in reviewed and reviewed[name].confirmed for name, _ in fields
    ):
        return None
    corrected = [
        _group(name)
        for name, field in fields
        if not _same(field.value, reviewed[name].value)
    ]
    manual = [
        (path, match)
        for path, match in item.data.matching_provenance.items()
        if match.origin == "manual"
    ]
    manual_positions = {
        position.group("index")
        for path, match in manual
        if match.category == "article" and (position := POSITION_PATH.match(path))
    }
    year, week, _ = item.reviewed_at.isocalendar()
    return InquiryOutcome(
        week=f"{year}-W{week:02d}",
        corrected_fields=corrected,
        reviewed_fields=[_group(name) for name, _ in fields],
        customer_reassigned=any(match.category == "customer" for _, match in manual),
        positions=len(item.extraction.positionen),
        articles_reassigned=len(manual_positions),
    )


def compute_pilot_metrics(items: list[ReviewedInquiry]) -> PilotMetrics:
    outcomes = [outcome for item in items if (outcome := evaluate(item)) is not None]
    if not outcomes:
        return PilotMetrics()
    corrected = Counter(key for o in outcomes for key in o.corrected_fields)
    reviewed = Counter(key for o in outcomes for key in o.reviewed_fields)
    by_week: dict[str, list[InquiryOutcome]] = defaultdict(list)
    for outcome in outcomes:
        by_week[outcome.week].append(outcome)
    total_corrections = sum(o.corrections for o in outcomes)
    return PilotMetrics(
        reviewed_inquiries=len(outcomes),
        without_correction=sum(o.corrections == 0 for o in outcomes),
        field_corrections=sum(len(o.corrected_fields) for o in outcomes),
        corrections_per_inquiry=round(total_corrections / len(outcomes), 2),
        customer_reassigned=sum(o.customer_reassigned for o in outcomes),
        positions=sum(o.positions for o in outcomes),
        articles_reassigned=sum(o.articles_reassigned for o in outcomes),
        corrections_by_field=sorted(
            (
                FieldCorrections(
                    group=group,
                    field=field,
                    corrections=corrected[(group, field)],
                    reviewed=count,
                )
                for (group, field), count in reviewed.items()
            ),
            key=lambda entry: (-entry.corrections, entry.group, entry.field),
        ),
        weekly=[
            WeeklyMetrics(
                week=week,
                reviewed_inquiries=len(week_outcomes),
                without_correction=sum(o.corrections == 0 for o in week_outcomes),
                corrections_per_inquiry=round(
                    sum(o.corrections for o in week_outcomes) / len(week_outcomes), 2
                ),
            )
            for week, week_outcomes in sorted(by_week.items())
        ],
    )


Prices = Callable[[str], tuple[float, float] | None]


class UsageEntry(Protocol):
    created_at: datetime
    model: str
    inquiry_id: UUID | None
    input_tokens: int
    output_tokens: int


def _cost(entries: Sequence[UsageEntry], prices: Prices) -> float | None:
    """Sum of all entries, None if a model has no configured price."""
    total = 0.0
    for entry in entries:
        price = prices(entry.model)
        if price is None:
            return None
        total += (
            entry.input_tokens / 1_000_000 * price[0]
            + entry.output_tokens / 1_000_000 * price[1]
        )
    return round(total, 4)


def compute_cost_metrics(entries: Sequence[UsageEntry], prices: Prices) -> CostMetrics:
    if not entries:
        return CostMetrics()
    inquiries = {entry.inquiry_id for entry in entries if entry.inquiry_id}
    input_tokens = sum(entry.input_tokens for entry in entries)
    output_tokens = sum(entry.output_tokens for entry in entries)
    count = max(len(inquiries), 1)
    by_week: dict[str, list[UsageEntry]] = defaultdict(list)
    for entry in entries:
        year, week, _ = entry.created_at.isocalendar()
        by_week[f"{year}-W{week:02d}"].append(entry)
    total = _cost(entries, prices)
    return CostMetrics(
        inquiries=len(inquiries),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_tokens_per_inquiry=input_tokens // count,
        output_tokens_per_inquiry=output_tokens // count,
        cost_eur=total,
        cost_per_inquiry_eur=round(total / count, 4) if total is not None else None,
        weekly=[
            WeeklyCosts(
                week=week,
                inquiries=len({e.inquiry_id for e in week_entries if e.inquiry_id}),
                input_tokens=sum(e.input_tokens for e in week_entries),
                output_tokens=sum(e.output_tokens for e in week_entries),
                cost_eur=_cost(week_entries, prices),
            )
            for week, week_entries in sorted(by_week.items())
        ],
    )
