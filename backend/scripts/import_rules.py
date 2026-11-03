"""Import document-derived rules; run from backend with python -m scripts.import_rules."""

import argparse
import asyncio
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import structlog
from rich.console import Console
from rich.progress import track
from rich.table import Table
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.rules import RuleUpdate
from app.persistence.domain.rules.schema.rule import Rule
from app.services.shared.database import database_service

logger = structlog.get_logger(__name__)
console = Console()
DEFAULT_FILE = (
    Path(__file__).resolve().parent / "data" / "angebotserstellung_rules.json"
)


def validate_key(value: object) -> str:
    if not isinstance(value, str):
        raise TypeError("Datensatz- und Regelschlüssel müssen Zeichenketten sein")
    key = value.strip()
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,100}", key):
        raise ValueError(f"Ungültiger Datensatz- oder Regelschlüssel: {value!r}")
    return key


def read_records(path: Path) -> list[Rule]:
    """Validate all rules using the existing domain model before opening a session."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or set(data) != {"dataset", "rules"}:
        raise ValueError("Die Importdatei muss genau dataset und rules enthalten")
    dataset = validate_key(data["dataset"])
    rows = data["rules"]
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000:
        raise ValueError("Die Importdatei muss zwischen 1 und 1000 Regeln enthalten")

    records: list[Rule] = []
    keys: set[str] = set()
    for index, row in enumerate(rows, 1):
        try:
            if not isinstance(row, dict):
                raise TypeError("Eine Regel muss ein JSON-Objekt sein")
            key = validate_key(row.get("key"))
            if key in keys:
                raise ValueError(f"Doppelter Regelschlüssel: {key}")
            validated = RuleUpdate.model_validate(
                {field: value for field, value in row.items() if field != "key"}
            )
            record = Rule.model_validate(
                {
                    "id": uuid5(
                        NAMESPACE_URL, f"estaro-poc:rule-import:{dataset}:{key}"
                    ),
                    **validated.model_dump(),
                }
            )
            keys.add(key)
            records.append(record)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{path.name}, Regel {index}: {exc}") from exc
    return records


async def import_records(
    session: AsyncSession, records: list[Rule], update_existing: bool
) -> dict[str, int]:
    """Stage all writes in the caller's transaction and preserve activation choices."""
    statement = select(Rule).where(col(Rule.id).in_([record.id for record in records]))
    existing = {record.id: record for record in (await session.exec(statement)).all()}
    summary = {"inserted": 0, "updated": 0, "skipped": 0}
    for record in track(records, description="Regeln importieren", console=console):
        current = existing.get(record.id)
        if current is None:
            session.add(record)
            summary["inserted"] += 1
            continue
        if not update_existing:
            summary["skipped"] += 1
            continue
        values = record.model_dump(
            include={"title", "instruction", "category", "section"}
        )
        if all(getattr(current, field) == value for field, value in values.items()):
            summary["skipped"] += 1
            continue
        current.sqlmodel_update(values)
        current.updated_at = datetime.now(UTC)
        session.add(current)
        summary["updated"] += 1
    await session.flush()
    return summary


async def run_import(path: Path, dry_run: bool, update_existing: bool) -> None:
    try:
        records = await asyncio.to_thread(read_records, path)
        active = sum(rule.is_active for rule in records)
        console.print(
            f"[green]Quelldatei mit {len(records)} Regeln validiert:[/green] "
            f"{active} aktiv, {len(records) - active} inaktiv."
        )
        if dry_run:
            console.print(
                "[yellow]Prüflauf: keine Datenbankverbindung und keine Änderungen.[/yellow]"
            )
            return

        async with database_service.session_factory() as session, session.begin():
            summary = await import_records(session, records, update_existing)

        table = Table(title="Regelimport abgeschlossen")
        for column in ("Neu", "Aktualisiert", "Übersprungen"):
            table.add_column(column, justify="right")
        table.add_row(
            str(summary["inserted"]), str(summary["updated"]), str(summary["skipped"])
        )
        console.print(table)
        logger.info("rule_import_completed", path=str(path), **summary)
    finally:
        await database_service.engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--file", type=Path, default=DEFAULT_FILE, help="JSON-Regelkatalog"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Alle Regeln validieren, ohne eine Datenbankverbindung zu öffnen",
    )
    parser.add_argument(
        "--update-existing",
        action="store_true",
        help="Vorhandene Importregeln aktualisieren; Aktivierungszustand erhalten",
    )
    args = parser.parse_args()
    try:
        asyncio.run(run_import(args.file, args.dry_run, args.update_existing))
    except (Exception, KeyboardInterrupt):
        logger.exception("rule_import_command_failed", path=str(args.file))
        console.print(
            "[red]Regelimport fehlgeschlagen. Details stehen im Fehlerprotokoll.[/red]"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
