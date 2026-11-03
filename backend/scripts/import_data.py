"""Import customer and article master data directly through async DB sessions."""

import argparse
import asyncio
import csv
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import structlog
from pydantic import BaseModel
from rich.console import Console
from rich.progress import track
from rich.table import Table
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

# Support direct execution from any working directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.domain.articles import Article as ArticleModel
from app.models.domain.customers import Customer as CustomerModel
from app.persistence.domain.articles.schema.article import Article
from app.persistence.domain.customers.schema.customer import Customer
from app.services.shared.database import database_service

logger = structlog.get_logger(__name__)
console = Console()
DEFAULT_RESOURCES = Path(__file__).resolve().parents[2] / "resources"
BATCH_SIZE = 500

ARTICLE_COLUMNS = {
    "Artikelnummer": "article_number",
    "Variante": "variant",
    "Matchcode Artikel": "matchcode",
    "Bezeichnung 1": "description_1",
    "Bezeichnung 2": "description_2",
    "Verkaufsmengeneinheit_Wert": "sales_unit_code",
    "Verkaufsmengeneinheit_Bezeichnung": "sales_unit_name",
    "Lagerbestand": "stock_quantity",
    "Gewicht in kg": "weight_kg",
    "Lagermengeneinheit_Wert": "stock_unit_code",
    "Lagermengeneinheit_Bezeichnung": "stock_unit_name",
    "Artikelgruppe_Wert": "article_group_code",
    "Artikelgruppe_Bezeichnung": "article_group_name",
    "Aktiv": "is_active",
    "Warennummer": "commodity_code",
    "Hauptlieferant": "main_supplier_code",
    "Hauptlagerplatz": "main_storage_location",
    "Memo": "has_memo",
    "Hersteller": "manufacturer",
    "Mengenberechnung_Wert": "quantity_calculation_code",
    "Mengenberechnung_Bezeichnung": "quantity_calculation_name",
    "Verkauf": "is_saleable",
    "Beschaffung": "is_purchasable",
    "Steuerklasse_Wert": "tax_class_code",
    "Steuerklasse_Bezeichnung": "tax_class_name",
    "Chargenpflicht": "batch_requirement",
    "Chargen Auswahl_Wert": "batch_selection_code",
    "Chargen Auswahl_Bezeichnung": "batch_selection_name",
    "Intrastat Eigenmasse in kg": "intrastat_net_mass_kg",
    "Exot": "is_exotic",
}
CUSTOMER_COLUMNS = {
    "Kundennummer": "customer_number",
    "Kunden-Matchcode": "matchcode",
    "Anrede": "salutation",
    "Name": "name",
    "Namenszusatz": "name_addition",
    "Druckprozess-Variante_Wert": "print_process_variant_code",
    "Gruppe-Adresse_Wert": "address_group_code",
    "Gruppe-Adresse_Bezeichnung": "address_group_name",
    "Land_Wert": "country_code",
    "Land_Bezeichnung": "country_name",
    "PLZ": "postal_code",
    "Ort": "city",
    "Telefon": "phone",
    "Währung_Wert": "currency_code",
    "Währung_Bezeichnung": "currency_name",
    "Zahlungskondition_Wert": "payment_terms_code",
    "Zahlungskondition_Bezeichnung": "payment_terms_name",
    "Vertreter": "representative_code",
    "Preisliste_Wert": "price_list_code",
    "Preisliste_Bezeichnung": "price_list_name",
    "Kundengruppe_Wert": "customer_group_code",
    "Kundengruppe_Bezeichnung": "customer_group_name",
    "Sprache_Wert": "language_code",
    "Sprache_Bezeichnung": "language_name",
    "Liefersperre": "delivery_blocked",
    "UStID-Nr.": "vat_id",
    "Aktiv-Kunden": "is_active",
    "Besteuerungsart_Wert": "taxation_type_code",
    "Besteuerungsart_Bezeichnung": "taxation_type_name",
    "Aufnahme": "admission_date",
    "Länderkürzel (nur EU)_Wert": "eu_country_code",
    "Länderkürzel (nur EU)_Bezeichnung": "eu_country_name",
    "Rechnungskreis_Wert": "invoice_cycle_code",
    "Rechnungskreis_Bezeichnung": "invoice_cycle_name",
    "Rabattliste_Wert": "discount_list_code",
    "Rabattliste_Bezeichnung": "discount_list_name",
}
BOOLEAN_FIELDS = {
    "is_active",
    "has_memo",
    "is_saleable",
    "is_purchasable",
    "is_exotic",
    "delivery_blocked",
}
DECIMAL_FIELDS = {"stock_quantity", "weight_kg", "intrastat_net_mass_kg"}


class ImportSummary(BaseModel):
    resource: str
    inserted: int = 0
    updated: int = 0


def parse_boolean(value: str) -> bool:
    """Decode German booleans, including the export's Access-style -1."""
    if value in {"Ja", "-1", "1"}:
        return True
    if value in {"Nein", "0"}:
        return False
    raise ValueError(f"Invalid boolean: {value!r}")


def read_records[Record: SQLModel](
    path: Path, columns: dict[str, str], model: type[Record]
) -> list[Record]:
    """Validate every source row before opening a database transaction."""
    records: list[Record] = []
    keys: set[tuple[str, ...]] = set()
    validator = ArticleModel if model is Article else CustomerModel
    with path.open(encoding="cp1252", newline="") as source:
        reader = csv.DictReader(source, delimiter=";", strict=True)
        missing = columns.keys() - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path.name}: missing columns: {sorted(missing)}")
        for row in reader:
            try:
                if None in row or any(value is None for value in row.values()):
                    raise ValueError("Row has an unexpected number of columns")
                values: dict[str, object] = {}
                for column, field in columns.items():
                    value = row[column].strip()
                    if field == "variant":
                        values[field] = value
                    elif not value:
                        values[field] = None
                    elif field in BOOLEAN_FIELDS:
                        values[field] = parse_boolean(value)
                    elif field in DECIMAL_FIELDS:
                        values[field] = Decimal(
                            value.replace(".", "").replace(",", ".")
                        )
                    elif field == "admission_date":
                        values[field] = datetime.strptime(value, "%d.%m.%Y").date()
                    else:
                        values[field] = value
                validated = validator.model_validate(values)
                record = model.model_validate(validated.model_dump(exclude={"id"}))
                key = record_key(record)
                if not key[0]:
                    raise ValueError("Record number must not be blank")
                if key in keys:
                    raise ValueError(f"Duplicate source key: {key!r}")
                keys.add(key)
                records.append(record)
            except (ValueError, ArithmeticError) as exc:
                raise ValueError(f"{path.name}, line {reader.line_num}: {exc}") from exc
    if not records:
        raise ValueError(f"{path.name}: no records found")
    return records


def record_key(record: SQLModel) -> tuple[str, ...]:
    """Preserve article variants and use the customer's stable business key."""
    if isinstance(record, Article):
        return record.article_number, record.variant
    if isinstance(record, Customer):
        return (record.customer_number,)
    raise TypeError(f"Unsupported record type: {type(record).__name__}")


async def import_records[Record: SQLModel](
    session: AsyncSession, model: type[Record], records: list[Record]
) -> ImportSummary:
    """Insert or update records directly, preserving existing primary keys."""
    summary = ImportSummary(resource=model.__name__)
    existing: dict[tuple[str, ...], Record] = {}
    for record in (await session.exec(select(model))).all():
        key = record_key(record)
        if key in existing:
            raise ValueError(f"Duplicate database key in {model.__name__}: {key!r}")
        existing[key] = record
    for index, record in enumerate(
        track(records, description=f"Importing {model.__name__}", console=console), 1
    ):
        current = existing.get(record_key(record))
        if current is None:
            session.add(record)
            summary.inserted += 1
        else:
            current.sqlmodel_update(record.model_dump(exclude={"id"}))
            summary.updated += 1
        if index % BATCH_SIZE == 0:
            await session.flush()
    await session.flush()
    return summary


async def run_import(resources: Path, dry_run: bool) -> None:
    """Read files off the event loop and commit both imports atomically."""
    try:
        articles = await asyncio.to_thread(
            read_records, resources / "Artikelstamm.csv", ARTICLE_COLUMNS, Article
        )
        customers = await asyncio.to_thread(
            read_records, resources / "Kundenstamm.csv", CUSTOMER_COLUMNS, Customer
        )
        if dry_run:
            console.print(
                f"[green]Validated {len(articles):,} articles and "
                f"{len(customers):,} customers. No database changes.[/green]"
            )
            return
        async with database_service.session_factory() as session, session.begin():
            summaries = [
                await import_records(session, Article, articles),
                await import_records(session, Customer, customers),
            ]
        table = Table(title="Import complete")
        for column in ("Resource", "Inserted", "Updated"):
            table.add_column(column)
        for summary in summaries:
            table.add_row(summary.resource, str(summary.inserted), str(summary.updated))
        console.print(table)
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
    args = parser.parse_args()
    try:
        asyncio.run(run_import(args.resources, args.dry_run))
    except (Exception, KeyboardInterrupt):
        logger.exception("data_import_command_failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
