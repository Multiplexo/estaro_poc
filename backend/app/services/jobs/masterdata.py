"""Master data import for articles and customers from CSV exports or a SQL source.

Both sources deliver rows keyed by the column names of the Sage CSV export
(e.g. "Artikelnummer", "Matchcode Artikel"). A SQL source therefore only needs a
query or view whose column aliases match those names.
"""

import csv
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import structlog
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import Settings
from app.models.domain.articles import Article as ArticleModel
from app.models.domain.customers import Customer as CustomerModel
from app.persistence.domain.articles.schema.article import Article
from app.persistence.domain.customers.schema.customer import Customer

logger = structlog.get_logger(__name__)

BATCH_SIZE = 500
CSV_ENCODING = "cp1252"
ARTICLES_FILE = "Artikelstamm.csv"
CUSTOMERS_FILE = "Kundenstamm.csv"

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
    deactivated: int = 0


@dataclass(frozen=True)
class MasterData:
    articles: list[Article]
    customers: list[Customer]


def parse_boolean(value: str) -> bool:
    """Decode German booleans, including the export's Access-style -1."""
    if value in {"Ja", "-1", "1", "true", "True"}:
        return True
    if value in {"Nein", "0", "false", "False"}:
        return False
    raise ValueError(f"Invalid boolean: {value!r}")


def convert_value(field: str, value: Any) -> Any:
    """Convert a CSV string or a typed SQL value to the model's field type."""
    if value is None:
        return "" if field == "variant" else None
    if isinstance(value, str):
        value = value.strip()
        if field == "variant":
            return value
        if not value:
            return None
        if field in BOOLEAN_FIELDS:
            return parse_boolean(value)
        if field in DECIMAL_FIELDS:
            return Decimal(value.replace(".", "").replace(",", "."))
        if field == "admission_date":
            return datetime.strptime(value, "%d.%m.%Y").date()
        return value
    if field in BOOLEAN_FIELDS:
        return parse_boolean(str(int(value)))
    if field in DECIMAL_FIELDS:
        return Decimal(str(value))
    if field == "admission_date" and isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return str(value)


def record_key(record: SQLModel) -> tuple[str, ...]:
    """Preserve article variants and use the customer's stable business key."""
    if isinstance(record, Article):
        return record.article_number, record.variant
    if isinstance(record, Customer):
        return (record.customer_number,)
    raise TypeError(f"Unsupported record type: {type(record).__name__}")


def parse_rows[Record: SQLModel](
    rows: Iterable[Mapping[str, Any]],
    columns: dict[str, str],
    model: type[Record],
    source: str,
) -> list[Record]:
    """Validate every source row before any database write."""
    records: list[Record] = []
    keys: set[tuple[str, ...]] = set()
    validator = ArticleModel if model is Article else CustomerModel
    for number, row in enumerate(rows, start=1):
        if number == 1:
            missing = columns.keys() - set(row.keys())
            if missing:
                raise ValueError(f"{source}: missing columns: {sorted(missing)}")
        try:
            values = {
                field: convert_value(field, row[column])
                for column, field in columns.items()
            }
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
            raise ValueError(f"{source}, row {number}: {exc}") from exc
    if not records:
        raise ValueError(f"{source}: no records found")
    return records


def read_csv[Record: SQLModel](
    path: Path, columns: dict[str, str], model: type[Record]
) -> list[Record]:
    with path.open(encoding=CSV_ENCODING, newline="") as source:
        reader = csv.DictReader(source, delimiter=";", strict=True)
        missing = columns.keys() - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path.name}: missing columns: {sorted(missing)}")

        def checked_rows() -> Iterable[dict[str, str]]:
            for row in reader:
                if None in row or any(value is None for value in row.values()):
                    raise ValueError(
                        f"{path.name}, line {reader.line_num}: "
                        "Row has an unexpected number of columns"
                    )
                yield row

        return parse_rows(checked_rows(), columns, model, path.name)


def read_csv_directory(directory: Path) -> MasterData:
    return MasterData(
        articles=read_csv(directory / ARTICLES_FILE, ARTICLE_COLUMNS, Article),
        customers=read_csv(directory / CUSTOMERS_FILE, CUSTOMER_COLUMNS, Customer),
    )


def read_sql(url: str, articles_query: str, customers_query: str) -> MasterData:
    """Read both resources from a SQL source (e.g. a read-only view in Sage)."""
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            article_rows = [
                {str(key): value for key, value in row.items()}
                for row in connection.execute(text(articles_query)).mappings()
            ]
            customer_rows = [
                {str(key): value for key, value in row.items()}
                for row in connection.execute(text(customers_query)).mappings()
            ]
    finally:
        engine.dispose()
    return MasterData(
        articles=parse_rows(article_rows, ARTICLE_COLUMNS, Article, "articles query"),
        customers=parse_rows(
            customer_rows, CUSTOMER_COLUMNS, Customer, "customers query"
        ),
    )


async def import_records[Record: SQLModel](
    session: AsyncSession,
    model: type[Record],
    records: list[Record],
    *,
    deactivate_missing: bool,
) -> ImportSummary:
    """Insert or update records, preserving primary keys; optionally deactivate
    records the source no longer delivers instead of deleting them."""
    summary = ImportSummary(resource=model.__name__)
    existing: dict[tuple[str, ...], Record] = {}
    for record in (await session.exec(select(model))).all():
        key = record_key(record)
        if key in existing:
            raise ValueError(f"Duplicate database key in {model.__name__}: {key!r}")
        existing[key] = record
    for index, record in enumerate(records, 1):
        current = existing.pop(record_key(record), None)
        if current is None:
            session.add(record)
            summary.inserted += 1
        else:
            current.sqlmodel_update(record.model_dump(exclude={"id"}))
            summary.updated += 1
        if index % BATCH_SIZE == 0:
            await session.flush()
    if deactivate_missing:
        for record in existing.values():
            if getattr(record, "is_active", False):
                record.sqlmodel_update({"is_active": False})
                summary.deactivated += 1
    await session.flush()
    return summary


async def store_master_data(
    sessions: async_sessionmaker[AsyncSession],
    data: MasterData,
    *,
    deactivate_missing: bool,
) -> list[ImportSummary]:
    """Write articles and customers in one transaction."""
    async with sessions() as session, session.begin():
        return [
            await import_records(
                session, Article, data.articles, deactivate_missing=deactivate_missing
            ),
            await import_records(
                session,
                Customer,
                data.customers,
                deactivate_missing=deactivate_missing,
            ),
        ]


def read_configured_source(settings: Settings) -> MasterData:
    if settings.MASTERDATA_SOURCE == "csv":
        return read_csv_directory(Path(settings.MASTERDATA_CSV_DIR))
    if settings.MASTERDATA_SOURCE == "sql":
        return read_sql(
            settings.MASTERDATA_SQL_URL,
            settings.MASTERDATA_ARTICLES_QUERY,
            settings.MASTERDATA_CUSTOMERS_QUERY,
        )
    raise ValueError("MASTERDATA_SOURCE is not configured")
