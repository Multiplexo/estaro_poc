"""Turn a reviewed inquiry into a Sage import file (CSV or XLSX).

The column layout comes from a JSON mapping (SAGE_EXPORT_MAPPING, default
app/exports/sage_default.json), so adapting to estaro's import template means
editing that file, not the code.
"""

import csv
import io
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import structlog
from openpyxl import Workbook

from app.models.domain.inquiry_data import InquiryData
from app.models.domain.sage_export import ExportColumn, ExportMapping, SageExport

logger = structlog.get_logger(__name__)

DEFAULT_MAPPING = Path(__file__).resolve().parents[2] / "exports" / "sage_default.json"
MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
LITERAL_PREFIX = "literal:"
POSITION_PREFIX = "position."


class ExportNotReadyError(ValueError):
    """The inquiry lacks data Sage needs; the message lists what is missing."""


@lru_cache(maxsize=4)
def load_mapping(path: str | None) -> ExportMapping:
    """Read and validate a mapping file; cached because it only changes on deploy."""
    source = Path(path) if path else DEFAULT_MAPPING
    return ExportMapping.model_validate_json(source.read_text(encoding="utf-8"))


def missing_for_export(data: InquiryData) -> list[str]:
    missing: list[str] = []
    if not (data.kundeninformationen and data.kundeninformationen.kunde):
        missing.append("Kundennummer")
    positions = data.positionen or []
    if not positions:
        missing.append("mindestens eine Position")
    missing.extend(
        f"Artikelnummer in Position {index}"
        for index, position in enumerate(positions, start=1)
        if not position.artikel
    )
    return missing


def _lookup(payload: dict[str, Any], path: str) -> Any:
    value: Any = payload
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _cell(
    column: ExportColumn,
    payload: dict[str, Any],
    position: dict[str, Any] | None,
    index: int | None,
) -> str:
    source = column.source
    if source.startswith(LITERAL_PREFIX):
        return source.removeprefix(LITERAL_PREFIX)
    if source == "position.index":
        value: Any = index
    elif source.startswith(POSITION_PREFIX):
        value = _lookup(position or {}, source.removeprefix(POSITION_PREFIX))
    else:
        value = _lookup(payload, source)
    if value is None or value == "":
        return column.default
    return " ".join(str(value).split()) if "\n" in str(value) else str(value)


def build_rows(data: InquiryData, mapping: ExportMapping) -> list[list[str]]:
    payload = data.model_dump(mode="json")
    positions: list[dict[str, Any]] = payload.get("positionen") or []
    if mapping.layout == "records":
        rows = [[_cell(c, payload, None, None) for c in mapping.header_columns]]
        rows.extend(
            [_cell(c, payload, position, index) for c in mapping.position_columns]
            for index, position in enumerate(positions, start=1)
        )
        return rows
    rows = [[column.title for column in mapping.columns]] if mapping.header_row else []
    rows.extend(
        [_cell(c, payload, position, index) for c in mapping.columns]
        for index, position in enumerate(positions, start=1)
    )
    return rows


def render(rows: list[list[str]], mapping: ExportMapping) -> bytes:
    if mapping.format == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        assert sheet is not None
        for row in rows:
            sheet.append(row)
        buffer = io.BytesIO()
        workbook.save(buffer)
        return buffer.getvalue()
    text = io.StringIO(newline="")
    csv.writer(text, delimiter=mapping.delimiter, lineterminator="\r\n").writerows(rows)
    return text.getvalue().encode(mapping.encoding, errors="replace")


def export_filename(data: InquiryData, fallback: str, extension: str) -> str:
    reference = (
        (data.belegdetails.ihreBelegnummer if data.belegdetails else None)
        or (data.belegdetails.belegZu if data.belegdetails else None)
        or fallback
    )
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", reference).strip("._")[:80] or fallback
    return f"sage-import-{safe}.{extension}"


def export_inquiry(
    data: InquiryData, fallback_name: str, mapping_path: str | None
) -> SageExport:
    missing = missing_for_export(data)
    if missing:
        raise ExportNotReadyError(
            "Für den Sage-Export fehlt: " + ", ".join(missing) + "."
        )
    mapping = load_mapping(mapping_path)
    content = render(build_rows(data, mapping), mapping)
    logger.info(
        "sage_export_created",
        positions=len(data.positionen or []),
        format=mapping.format,
        layout=mapping.layout,
    )
    return SageExport(
        filename=export_filename(data, fallback_name, mapping.format),
        media_type=MEDIA_TYPES[mapping.format],
        content=content,
    )
