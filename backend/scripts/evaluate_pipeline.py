"""Run extraction and matching on sample inquiries without API or worker; run from
backend with python -m scripts.evaluate_pipeline FILE_OR_DIR [...].

Uses the configured AI provider (LLM_BASE_URL, API_KEY, MODEL) and database
(master data, rules and designation list must be imported). Files are read from
disk instead of MinIO; e-mail attachments become child documents like an upload.
Writes a JSON and a Markdown report with results, run time and token usage.
With --expected GOLDEN.xlsx the run is scored against the golden set (see
scripts.golden_set).
"""

import argparse
import asyncio
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import structlog
from langchain_core.callbacks import get_usage_metadata_callback
from pydantic import BaseModel, Field
from rich.console import Console
from rich.table import Table

from app.config import get_settings
from app.models.domain.inquiries import FileType, InquiryDocument
from app.models.domain.inquiry_mapping import map_extraction_to_inquiry
from app.models.domain.rules import RuleCategory
from app.models.jobs.extraction import ExtractionStatus, extraction_fields
from app.models.jobs.matching import MatchingJobStatus, MatchingResult
from app.persistence.domain.articles.article_repository import ArticleRepository
from app.persistence.jobs.matching.memory_repository import matching_memory
from app.pipelines.extraction.pipeline import run_pipeline
from app.pipelines.matching.agents import MatchingAgents
from app.pipelines.matching.pipeline import run_matching_pipeline
from app.services.factory import create_rule_service
from app.services.shared.ai import AIService, describe_ai_error
from app.services.shared.database import database_service
from app.services.shared.email import parse_email
from scripts.golden_set import load_golden, rate, score, score_markdown

logger = structlog.get_logger(__name__)
console = Console()

SUFFIX_TYPES = {".pdf": FileType.PDF, ".msg": FileType.MSG, ".eml": FileType.EML}


class FileStorage:
    """Stands in for MinioService.get_inquiry_file during evaluation."""

    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    async def get_inquiry_file(self, source_key: str) -> bytes:
        return self.files[source_key]


class PositionResult(BaseModel):
    text: str
    article_number: str | None = None
    matchcode: str | None = None
    description: str | None = None
    confidence: float = 0
    conflicts: list[str] = Field(default_factory=list)


class InquiryResult(BaseModel):
    file: str
    ok: bool
    error: str | None = None
    seconds: float = 0
    input_tokens: int = 0
    output_tokens: int = 0
    extraction_input_tokens: int = 0
    extraction_seconds: float = 0
    tokens_by_model: dict[str, tuple[int, int]] = Field(default_factory=dict)
    customer_number: str | None = None
    customer_name: str | None = None
    customer_confidence: float = 0
    fields_missing: int = 0
    positions: list[PositionResult] = Field(default_factory=list)


def sources_for(path: Path, storage: FileStorage) -> list[InquiryDocument]:
    inquiry_id = uuid4()
    file_type = SUFFIX_TYPES[path.suffix.lower()]
    content = path.read_bytes()
    root = InquiryDocument(
        inquiry_id=inquiry_id,
        filename=path.name,
        file_type=file_type,
        source_key=f"eval/{inquiry_id}/{path.name}",
    )
    storage.files[str(root.source_key)] = content
    documents = [root]
    if file_type.is_email:
        for attachment in parse_email(content, file_type).attachments:
            child = InquiryDocument(
                inquiry_id=inquiry_id,
                filename=attachment.filename,
                parent_document_id=root.id,
                file_type=FileType.PDF,
                source_key=f"eval/{inquiry_id}/{uuid4()}.pdf",
            )
            storage.files[str(child.source_key)] = attachment.content
            documents.append(child)
    return documents


def position_text(item: Any) -> str:
    parts = [
        getattr(item, name).value
        for name in (
            "menge",
            "mengeneinheit",
            "bezeichnung",
            "dimensionstext",
            "werkstoff",
        )
        if getattr(getattr(item, name, None), "value", None)
    ]
    return " ".join(str(part) for part in parts)


async def noop_progress(step: str, completed_steps: int) -> None:
    return None


def usage_totals(usage: dict[str, Any]) -> tuple[int, int]:
    return (
        sum(int(entry.get("input_tokens", 0)) for entry in usage.values()),
        sum(int(entry.get("output_tokens", 0)) for entry in usage.values()),
    )


async def evaluate_file(path: Path, prompts: dict[str, str]) -> InquiryResult:
    settings = get_settings()
    storage = FileStorage()
    started = time.perf_counter()
    with get_usage_metadata_callback() as usage:
        try:
            sources = sources_for(path, storage)
            async with AIService(settings) as ai:
                extraction = await run_pipeline(
                    sources,
                    storage,  # type: ignore[arg-type]
                    ai,
                    noop_progress,
                    settings.EXTRACTION_CONFIDENCE_THRESHOLD,
                    prompts["extraction"],
                )
                extraction_tokens = usage_totals(usage.usage_metadata)[0]
                extraction_seconds = round(time.perf_counter() - started, 1)
                data = map_extraction_to_inquiry(extraction)
                job = MatchingJobStatus(
                    id=uuid4(),
                    extraction_job_id=uuid4(),
                    inquiry_id=sources[0].inquiry_id,
                    status=ExtractionStatus.RUNNING,
                    input_revision=0,
                    input_data=data,
                    source_conflicts=[],
                    result=None,
                    error=None,
                    created_at=datetime.now(UTC),
                    started_at=None,
                    finished_at=None,
                )
                async with matching_memory(
                    settings, database_service.session_factory
                ) as memory:
                    agents = MatchingAgents(
                        database_service.session_factory,
                        ai,
                        memory,
                        prompts["matching"],
                        recursion_limit=settings.RECURSION_LIMIT,
                    )
                    matching = await run_matching_pipeline(
                        job, agents, settings.MATCHING_CONCURRENCY
                    )
        except Exception as error:
            logger.exception("evaluation_file_failed", file=path.name)
            tokens = usage_totals(usage.usage_metadata)
            return InquiryResult(
                file=path.name,
                ok=False,
                error=describe_ai_error(error, settings.MODEL) or repr(error)[:300],
                seconds=round(time.perf_counter() - started, 1),
                input_tokens=tokens[0],
                output_tokens=tokens[1],
            )
        tokens = usage_totals(usage.usage_metadata)
        by_model = {
            model: (
                int(entry.get("input_tokens", 0)),
                int(entry.get("output_tokens", 0)),
            )
            for model, entry in usage.usage_metadata.items()
        }
    matchcodes = await article_matchcodes(matching)
    result = build_result(path, extraction, matching, started, tokens, matchcodes)
    result.extraction_input_tokens = extraction_tokens
    result.extraction_seconds = extraction_seconds
    result.tokens_by_model = by_model
    return result


async def article_matchcodes(matching: MatchingResult) -> dict[str, str]:
    ids = [a.selected.entity_id for a in matching.articles if a.selected]
    found: dict[str, str] = {}
    async with database_service.session_factory() as session:
        repository = ArticleRepository(session)
        for entity_id in ids:
            article = await repository.get_article(int(entity_id))
            if article is not None and article.matchcode:
                found[entity_id] = article.matchcode
    return found


def build_result(
    path: Path,
    extraction: Any,
    matching: MatchingResult,
    started: float,
    tokens: tuple[int, int],
    matchcodes: dict[str, str],
) -> InquiryResult:
    customer = matching.customer.selected
    positions = []
    for article in matching.articles:
        item = extraction.positionen[article.position_index]
        selected = article.selected
        positions.append(
            PositionResult(
                text=position_text(item),
                article_number=selected.number if selected else None,
                matchcode=matchcodes.get(selected.entity_id) if selected else None,
                description=selected.label if selected else None,
                confidence=article.confidence,
                conflicts=article.conflicts,
            )
        )
    return InquiryResult(
        file=path.name,
        ok=True,
        seconds=round(time.perf_counter() - started, 1),
        input_tokens=tokens[0],
        output_tokens=tokens[1],
        customer_number=customer.number if customer else None,
        customer_name=customer.label if customer else None,
        customer_confidence=matching.customer.confidence,
        fields_missing=sum(
            1 for _, field in extraction_fields(extraction) if field.status == "missing"
        ),
        positions=positions,
    )


async def load_prompts() -> dict[str, str]:
    async with database_service.session_factory() as session:
        rules = create_rule_service(session)
        return {
            "extraction": await rules.prompt(RuleCategory.EXTRACTION),
            "matching": await rules.prompt(RuleCategory.MATCHING),
        }


def collect(paths: list[Path], limit: int | None) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(
                sorted(p for p in path.rglob("*") if p.suffix.lower() in SUFFIX_TYPES)
            )
        elif path.suffix.lower() in SUFFIX_TYPES:
            files.append(path)
    return files[:limit] if limit else files


def to_markdown(results: list[InquiryResult], model: str) -> str:
    lines = [
        f"# Auswertung Pipeline ({model}, {datetime.now(UTC):%Y-%m-%d %H:%M} UTC)",
        "",
        "| Datei | Kunde | Positionen (zugeordnet) | Sekunden (davon Extraktion) | Tokens ein/aus (davon Extraktion) |",
        "|---|---|---|---:|---:|",
    ]
    for result in results:
        if not result.ok:
            lines.append(
                f"| {result.file} | **Fehler:** {result.error} | | {result.seconds} | |"
            )
            continue
        assigned = sum(1 for p in result.positions if p.article_number)
        lines.append(
            f"| {result.file} | {result.customer_number or '–'} {result.customer_name or ''}"
            f" | {len(result.positions)} ({assigned})"
            f" | {result.seconds} ({result.extraction_seconds})"
            f" | {result.input_tokens}/{result.output_tokens}"
            f" ({result.extraction_input_tokens}) |"
        )
    for result in results:
        if not result.ok or not result.positions:
            continue
        lines += [
            "",
            f"## {result.file}",
            "",
            "| Anfrage | Artikel | Matchcode | Konfidenz | Hinweise |",
            "|---|---|---|---:|---|",
        ]
        for p in result.positions:
            conflicts = "; ".join(p.conflicts).replace("|", "/")[:300]
            lines.append(
                f"| {p.text} | {p.article_number or '–'} | {p.matchcode or ''}"
                f" | {p.confidence:.2f} | {conflicts} |"
            )
    return "\n".join(lines) + "\n"


async def run(files: list[Path], output: Path) -> list[InquiryResult]:
    results: list[InquiryResult] = []
    try:
        prompts = await load_prompts()
        for index, path in enumerate(files, start=1):
            with console.status(f"[{index}/{len(files)}] {path.name}"):
                result = await evaluate_file(path, prompts)
            results.append(result)
            logger.info(
                "evaluation_file_completed",
                file=path.name,
                ok=result.ok,
                seconds=result.seconds,
                positions=len(result.positions),
            )
            output.with_suffix(".json").write_text(
                json.dumps(
                    [r.model_dump() for r in results], ensure_ascii=False, indent=1
                ),
                encoding="utf-8",
            )
    finally:
        await database_service.engine.dispose()
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--output", type=Path, default=Path("evaluation"))
    parser.add_argument("--expected", type=Path, help="Golden set (.xlsx)")
    parser.add_argument("--confirmed-only", action="store_true")
    args = parser.parse_args()
    files = collect(args.paths, args.limit)
    if not files:
        console.print("[red]Keine PDF-, MSG- oder EML-Dateien gefunden.[/red]")
        return 1
    model = get_settings().MODEL
    results = asyncio.run(run(files, args.output))
    report = to_markdown(results, model)
    golden_score = None
    if args.expected:
        golden_score = score(
            [r.model_dump() for r in results],
            load_golden(args.expected, args.confirmed_only),
        )
        report = report + "\n" + score_markdown(golden_score)
    args.output.with_suffix(".md").write_text(report, encoding="utf-8")

    table = Table(title=f"Auswertung ({model})")
    for column in ("Datei", "Kunde", "Pos.", "zugeordnet", "Sek.", "Tokens ein/aus"):
        table.add_column(column)
    for r in results:
        table.add_row(
            r.file[:40],
            "FEHLER" if not r.ok else (r.customer_number or "–"),
            str(len(r.positions)),
            str(sum(1 for p in r.positions if p.article_number)),
            str(r.seconds),
            f"{r.input_tokens}/{r.output_tokens}",
        )
    console.print(table)
    if golden_score:
        console.print(
            f"Kunde richtig: {rate(golden_score.customers_correct, golden_score.customers)}"
            f" · Artikel richtig: "
            f"{rate(golden_score.positions_correct, golden_score.positions)}"
        )
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
