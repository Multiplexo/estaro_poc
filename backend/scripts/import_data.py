"""Import customer and article master data from the CSV exports; run from backend
with python -m scripts.import_data [--resources DIR].

The same import runs nightly in the worker when MASTERDATA_SOURCE is set
(app/services/jobs/masterdata.py).
"""

import argparse
import asyncio
import sys
from pathlib import Path

import structlog
from rich.console import Console
from rich.table import Table

# Support direct execution from any working directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.jobs.masterdata import (
    ImportSummary,
    read_csv_directory,
    store_master_data,
)
from app.services.shared.database import database_service

logger = structlog.get_logger(__name__)
console = Console()
DEFAULT_RESOURCES = Path(__file__).resolve().parents[2] / "resources"


def render(summaries: list[ImportSummary]) -> Table:
    table = Table(title="Import complete")
    for column in ("Resource", "Inserted", "Updated", "Deactivated"):
        table.add_column(column)
    for summary in summaries:
        table.add_row(
            summary.resource,
            str(summary.inserted),
            str(summary.updated),
            str(summary.deactivated),
        )
    return table


async def run_import(resources: Path, dry_run: bool, deactivate_missing: bool) -> None:
    """Read files off the event loop and commit both imports atomically."""
    try:
        with console.status("Reading CSV files"):
            data = await asyncio.to_thread(read_csv_directory, resources)
        if dry_run:
            console.print(
                f"[green]Validated {len(data.articles):,} articles and "
                f"{len(data.customers):,} customers. No database changes.[/green]"
            )
            return
        with console.status("Writing master data"):
            summaries = await store_master_data(
                database_service.session_factory,
                data,
                deactivate_missing=deactivate_missing,
            )
        console.print(render(summaries))
        logger.info(
            "data_import_completed", summaries=[s.model_dump() for s in summaries]
        )
    except Exception:
        logger.exception("data_import_failed", resources=str(resources))
        raise
    finally:
        await database_service.engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resources", type=Path, default=DEFAULT_RESOURCES)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate CSVs without writing to the database",
    )
    parser.add_argument(
        "--deactivate-missing",
        action="store_true",
        help="Deactivate articles and customers that are no longer in the CSVs",
    )
    args = parser.parse_args()
    try:
        asyncio.run(run_import(args.resources, args.dry_run, args.deactivate_missing))
    except (Exception, KeyboardInterrupt):
        logger.exception("data_import_command_failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
