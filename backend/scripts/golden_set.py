"""Golden set: expected customer and articles per sample inquiry, kept as an Excel
file that the sales team confirms. Run from backend:

python -m scripts.golden_set create RESULTS.json GOLDEN.xlsx
    prefills the Excel file from a result of scripts.evaluate_pipeline
python -m scripts.evaluate_pipeline FILES --expected GOLDEN.xlsx
    scores a run against the confirmed values

Columns: Datei, Art (Kunde, Position, Zusatz), Nr., Anfragetext, Erwartet,
Bezeichnung, Bestätigt, Hinweis. Erwartet holds the customer or article number,
"keine" when nothing may be assigned, and stays empty when it is still unknown
(the row is then not scored). Positions are compared by their order in the inquiry.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Literal

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from openpyxl.worksheet.datavalidation import DataValidation
from pydantic import BaseModel, Field
from rich.console import Console

console = Console()

COLUMNS = (
    "Datei",
    "Art",
    "Nr.",
    "Anfragetext",
    "Erwartet",
    "Bezeichnung",
    "Bestätigt",
    "Hinweis",
)
WIDTHS = (42, 10, 5, 70, 12, 28, 10, 60)
NONE_VALUE = "keine"
SHEET = "Golden Set"
RowKind = Literal["Kunde", "Position", "Zusatz"]


class Expectation(BaseModel):
    kind: RowKind
    index: int = 0
    expected: str | None = Field(
        default=None, description="Number, NONE_VALUE or None if still unknown"
    )
    confirmed: bool = False


class GoldenInquiry(BaseModel):
    file: str
    customer: Expectation | None = None
    positions: dict[int, Expectation] = Field(default_factory=dict)
    accessories: list[str] = Field(default_factory=list)


class Score(BaseModel):
    scored_files: int = 0
    customers: int = 0
    customers_correct: int = 0
    positions: int = 0
    positions_correct: int = 0
    positions_count_mismatch: list[str] = Field(default_factory=list)
    accessories: int = 0
    accessories_found: int = 0
    misses: list[str] = Field(default_factory=list)


def cell_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if isinstance(value, float) and value.is_integer():
        text = str(int(value))
    return text or None


def load_golden(path: Path, confirmed_only: bool = False) -> dict[str, GoldenInquiry]:
    book = load_workbook(path, read_only=True)
    sheet = book[SHEET] if SHEET in book.sheetnames else book.active
    if sheet is None:
        return {}
    golden: dict[str, GoldenInquiry] = {}
    for row in sheet.iter_rows(min_row=2, values_only=True):
        file, kind, index, _, expected, _, confirmed = (
            cell_text(value) for value in (*row, *[None] * 7)[:7]
        )
        if not file or kind not in ("Kunde", "Position", "Zusatz"):
            continue
        entry = Expectation(
            kind=kind,  # type: ignore[arg-type]
            index=int(index or 0),
            expected=expected,
            confirmed=(confirmed or "").lower() in ("ja", "x", "yes"),
        )
        if confirmed_only and not entry.confirmed:
            continue
        inquiry = golden.setdefault(file, GoldenInquiry(file=file))
        if kind == "Kunde":
            inquiry.customer = entry
        elif kind == "Position":
            inquiry.positions[entry.index] = entry
        elif expected:
            inquiry.accessories.append(expected)
    return golden


def same(expected: str, actual: str | None) -> bool:
    if expected.lower() == NONE_VALUE:
        return actual is None
    return expected == (actual or "")


def score(results: list[dict], golden: dict[str, GoldenInquiry]) -> Score:
    """Compare evaluation results (InquiryResult dumps) with the golden set."""
    total = Score()
    for result in results:
        inquiry = golden.get(result["file"])
        if inquiry is None or not result.get("ok"):
            continue
        total.scored_files += 1
        name = result["file"]
        customer = inquiry.customer
        if customer and customer.expected:
            total.customers += 1
            if same(customer.expected, result.get("customer_number")):
                total.customers_correct += 1
            else:
                total.misses.append(
                    f"{name}: Kunde {result.get('customer_number') or 'keine'}"
                    f" statt {customer.expected}"
                )
        positions = result.get("positions", [])
        if inquiry.positions and len(positions) != len(inquiry.positions):
            total.positions_count_mismatch.append(
                f"{name}: {len(positions)} statt {len(inquiry.positions)} Positionen"
            )
        for index, expectation in sorted(inquiry.positions.items()):
            if not expectation.expected:
                continue
            total.positions += 1
            actual = (
                positions[index - 1].get("article_number")
                if 0 < index <= len(positions)
                else None
            )
            if same(expectation.expected, actual):
                total.positions_correct += 1
            else:
                total.misses.append(
                    f"{name}: Position {index} {actual or 'keine'}"
                    f" statt {expectation.expected}"
                )
        suggested = {
            accessory
            for position in positions
            for accessory in position.get("accessories", [])
        }
        for accessory in inquiry.accessories:
            total.accessories += 1
            if accessory in suggested:
                total.accessories_found += 1
            else:
                total.misses.append(f"{name}: Zusatzposition {accessory} fehlt")
    return total


def rate(part: int, total: int) -> str:
    return f"{part}/{total} ({round(part / total * 100)} %)" if total else "–"


def score_markdown(result: Score) -> str:
    lines = [
        "## Trefferquote gegen Golden Set",
        "",
        f"- Bewertete Anfragen: {result.scored_files}",
        f"- Kunde richtig: {rate(result.customers_correct, result.customers)}",
        "- Artikel richtig (inkl. richtig nicht zugeordnet): "
        + rate(result.positions_correct, result.positions),
        "- Zusatzpositionen vorgeschlagen: "
        + rate(result.accessories_found, result.accessories),
    ]
    if result.positions_count_mismatch:
        lines += ["", "Abweichende Positionsanzahl:", ""]
        lines += [f"- {entry}" for entry in result.positions_count_mismatch]
    if result.misses:
        lines += ["", "Abweichungen:", ""]
        lines += [f"- {entry}" for entry in result.misses]
    return "\n".join(lines) + "\n"


def create(results_path: Path, output: Path) -> int:
    results = json.loads(results_path.read_text(encoding="utf-8"))
    book = Workbook()
    sheet = book.active
    if sheet is None:
        return 1
    sheet.title = SHEET
    sheet.append(COLUMNS)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for letter, width in zip("ABCDEFGH", WIDTHS, strict=True):
        sheet.column_dimensions[letter].width = width
    sheet.freeze_panes = "A2"
    for result in results:
        if not result.get("ok"):
            continue
        sheet.append(
            (
                result["file"],
                "Kunde",
                None,
                None,
                result.get("customer_number") or NONE_VALUE,
                result.get("customer_name"),
                "nein",
                None,
            )
        )
        for index, position in enumerate(result.get("positions", []), start=1):
            sheet.append(
                (
                    result["file"],
                    "Position",
                    index,
                    position.get("text"),
                    position.get("article_number") or NONE_VALUE,
                    position.get("matchcode"),
                    "nein",
                    "; ".join(position.get("conflicts", []))[:300] or None,
                )
            )
    confirmed = DataValidation(type="list", formula1='"ja,nein"', allow_blank=True)
    sheet.add_data_validation(confirmed)
    confirmed.add(f"G2:G{sheet.max_row}")
    book.save(output)
    console.print(
        f"[green]{sheet.max_row - 1} Zeilen nach {output} geschrieben.[/green]"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create_parser = commands.add_parser("create")
    create_parser.add_argument("results", type=Path)
    create_parser.add_argument("output", type=Path)
    score_parser = commands.add_parser("score")
    score_parser.add_argument("results", type=Path)
    score_parser.add_argument("golden", type=Path)
    score_parser.add_argument("--confirmed-only", action="store_true")
    args = parser.parse_args()
    if args.command == "create":
        return create(args.results, args.output)
    results = json.loads(args.results.read_text(encoding="utf-8"))
    console.print(
        score_markdown(score(results, load_golden(args.golden, args.confirmed_only)))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
