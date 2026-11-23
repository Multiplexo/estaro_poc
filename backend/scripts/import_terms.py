"""Import estaro's designation list (Bezeichnungen.xlsx) for article matching; run
from backend with python -m scripts.import_terms --file PATH.

Replaces the whole list in the database. The Excel file stays the single source of
truth; it is not stored in the repository.
"""

import argparse
import asyncio
import sys
from collections import Counter
from pathlib import Path

import structlog
from rich.console import Console
from rich.table import Table

# Support direct execution from any working directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.persistence.domain.terms.term_repository import TermRepository
from app.services.domain.terms import read_term_workbook
from app.services.shared.database import database_service

logger = structlog.get_logger(__name__)
console = Console()


async def run_import(path: Path, dry_run: bool) -> None:
    try:
        terms = await asyncio.to_thread(read_term_workbook, path)
        counts = Counter(term.kind.value for term in terms)
        table = Table(title="Bezeichnungsliste")
        for column in ("Art", "Einträge"):
            table.add_column(column)
        for kind, count in sorted(counts.items()):
            table.add_row(kind, str(count))
        console.print(table)
        if dry_run:
            console.print("[yellow]Prüflauf: keine Datenbankänderungen.[/yellow]")
            return
        async with database_service.session_factory() as session:
            await TermRepository(session).replace_all(terms)
        logger.info("article_terms_imported", count=len(terms), **counts)
    finally:
        await database_service.engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, required=True, help="Bezeichnungen.xlsx")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        asyncio.run(run_import(args.file, args.dry_run))
    except (Exception, KeyboardInterrupt):
        logger.exception("article_terms_import_failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
