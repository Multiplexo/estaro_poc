"""estaro's designation list: maps how customers write article types, materials and
accessories to estaro's internal codes and matchcode patterns.

Example: "nahtloses Edelstahlrohr 14x1,5, AISI 316Ti" -> category "nr" and material
"4571" -> matchcode "nr 14x1,5 4571".
"""

import re
from collections.abc import Sequence
from pathlib import Path

import structlog
from openpyxl import load_workbook

from app.models.domain.terms import ArticleTerm, TermKind, TermMatch

logger = structlog.get_logger(__name__)

KIND_BY_LABEL = {
    "artikel kategorie": TermKind.CATEGORY,
    "werkstoff": TermKind.MATERIAL,
    "artikel zubehör": TermKind.ACCESSORY,
}
# Known errors in the delivered list, corrected until estaro confirms or fixes them.
# The article master uses "gb" for welded elbows ("gb 60,3x2 4828"), "gr" is a
# welded pipe.
CODE_CORRECTIONS = {(TermKind.CATEGORY, "geschweißter Bogen"): "gb"}
PIPE_CODES = {"nr", "gr", "nb", "gb"}
SHEET_FORMATS = {
    "k": "Kleinformat",
    "m": "Mittelformat",
    "g": "Großformat",
    "s": "Maxiformat",
}
MATERIAL_NUMBER = re.compile(r"^(?:1\.)?(4\d{3})$")
SIZE_SYNONYM = re.compile(r"^\s*(\d{3,4})\s*mm\s*x\s*(\d{3,4})\s*mm\s*$", re.IGNORECASE)
# Bare short numbers ("304", "321") are only materials when introduced as such.
SHORT_NUMBER = re.compile(r"^\d{1,3}$")
MATERIAL_PREFIX = r"(?:aisi|tp|type|typ|grade|werkstoff)\s*"
# Correct spellings added next to known misspellings in the list.
SPELLING_VARIANTS = {
    "seemless": "seamless",
    "certifikate": "certificate",
    "certifikat": "certificate",
    "urspungszeugnis": "ursprungszeugnis",
}
# Courtesy phrases that contain an accessory wording without meaning it.
EXCLUDED_CONTEXT = {
    (TermKind.ACCESSORY, "zur Verfügung"): re.compile(
        r"(steh\w*|stell\w*)[^.!?]{0,40}zur verfügung"
    ),
}


def normalize(text: str) -> str:
    text = text.replace("‑", "-").replace("–", "-").replace(" ", " ")
    return re.sub(r"\s+", " ", text).strip().casefold()


def _cell(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def parse_term_rows(rows: Sequence[Sequence[object]]) -> list[ArticleTerm]:
    """Rows as in the sheet: Art, Artikelnummer, estaro Bezeichnung, Synonym 1..n."""
    terms: list[ArticleTerm] = []
    for number, row in enumerate(rows, start=2):
        label, article_number, code, *synonyms = [_cell(value) for value in row]
        if not label and not code:
            continue
        kind = KIND_BY_LABEL.get(label.casefold())
        if kind is None or not code:
            raise ValueError(
                f"Zeile {number}: unbekannte Art {label!r} oder leere Bezeichnung"
            )
        values = [synonym for synonym in synonyms if synonym]
        if kind is TermKind.ACCESSORY:
            # The designation itself may be misspelled ("Urspungszeugnis").
            values = [v for v in _with_spelling_variants([code, *values]) if v != code]
        else:
            values = _with_spelling_variants(values)
        first_synonym = values[0] if values else ""
        corrected = CODE_CORRECTIONS.get((kind, first_synonym))
        if corrected and corrected != code:
            logger.warning(
                "article_term_code_corrected", row=number, original=code, code=corrected
            )
            code = corrected
        if kind is TermKind.MATERIAL:
            terms.extend(_split_material(code, values))
        else:
            terms.append(
                ArticleTerm(
                    kind=kind,
                    code=code,
                    synonyms=list(dict.fromkeys(values)),
                    article_number=article_number or None,
                )
            )
    return terms


def _with_spelling_variants(values: list[str]) -> list[str]:
    result = list(values)
    for value in values:
        corrected = value
        for wrong, right in SPELLING_VARIANTS.items():
            corrected = re.sub(wrong, right, corrected, flags=re.IGNORECASE)
        if corrected != value:
            result.append(corrected)
    return list(dict.fromkeys(result))


def _split_material(code: str, values: list[str]) -> list[ArticleTerm]:
    """A material row may continue with a second material that estaro offers as
    the row's code instead (e.g. 4404 row lists 1.4401 / AISI 316)."""
    own: list[str] = []
    substitutes: dict[str, list[str]] = {}
    current: str | None = None
    for value in values:
        number = MATERIAL_NUMBER.match(value.replace(" ", ""))
        if number and number.group(1) != code:
            current = number.group(1)
        if current is None:
            own.append(value)
        else:
            substitutes.setdefault(current, []).append(value)
    terms = [
        ArticleTerm(
            kind=TermKind.MATERIAL, code=code, synonyms=list(dict.fromkeys(own))
        )
    ]
    terms.extend(
        ArticleTerm(
            kind=TermKind.MATERIAL,
            code=code,
            synonyms=list(dict.fromkeys(synonyms)),
            substitute_for=requested,
        )
        for requested, synonyms in substitutes.items()
    )
    return terms


def read_term_workbook(path: Path) -> list[ArticleTerm]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook.worksheets[0]
        rows = [list(row) for row in sheet.iter_rows(min_row=2, values_only=True)]
    finally:
        workbook.close()
    return parse_term_rows(rows)


def _pattern(synonym: str, kind: TermKind) -> re.Pattern[str]:
    size = SIZE_SYNONYM.match(synonym)
    if size:
        return re.compile(
            rf"(?<!\d){size.group(1)}\s*(?:mm)?\s*[x×*]\s*{size.group(2)}(?!\d)"
        )
    value = re.escape(normalize(synonym)).replace(r"\ ", r"\s*")
    if kind is TermKind.MATERIAL and SHORT_NUMBER.match(synonym):
        return re.compile(rf"{MATERIAL_PREFIX}{value}(?![\w])")
    return re.compile(rf"(?<![\w.]){value}(?![\w])")


def _category_details(code: str, synonyms: list[str]) -> tuple[str | None, str | None]:
    lowered = code.replace(" ", "").casefold()
    if lowered in PIPE_CODES:
        return f"{lowered} <Außendurchmesser>x<Wandstärke> <Werkstoff>", None
    if lowered == "rd":
        return "Rd <Durchmesser> <Werkstoff>", None
    if lowered.startswith("stärke") and lowered[-1] in SHEET_FORMATS:
        letter = lowered[-1]
        size = next((s for s in synonyms if SIZE_SYNONYM.match(s)), None)
        hint = f"Blech {SHEET_FORMATS[letter]}" + (f" ({size.strip()})" if size else "")
        return f"<Stärke>{letter} <Werkstoff>", hint
    return None, None


def _find(term: ArticleTerm, normalized: str) -> tuple[str, tuple[int, int]] | None:
    candidates = (
        [term.code, *term.synonyms] if term.substitute_for is None else term.synonyms
    )
    for candidate in sorted(set(candidates), key=len, reverse=True):
        if term.kind is TermKind.CATEGORY and candidate == term.code:
            continue  # Codes such as "nr" or "rd" are too short to search for.
        found = _pattern(candidate, term.kind).search(normalized)
        if found:
            return candidate, found.span()
    return None


def _excluded(term: ArticleTerm, normalized: str) -> bool:
    context = EXCLUDED_CONTEXT.get((term.kind, term.code))
    return bool(context and context.search(normalized))


def _hint(term: ArticleTerm) -> tuple[str | None, str | None]:
    if term.kind is TermKind.CATEGORY:
        return _category_details(term.code, term.synonyms)
    if term.kind is TermKind.MATERIAL and term.substitute_for:
        return None, (
            f"Angefragt ist {term.substitute_for}; estaro bietet stattdessen "
            f"{term.code} an. Abweichung in der Begründung nennen."
        )
    if term.kind is TermKind.ACCESSORY:
        return None, (
            f"Zubehör: als eigene Position mit Artikel {term.article_number} ergänzen."
            if term.article_number
            else "Zubehör ohne Artikelnummer: als Hinweis zur Anfrage übernehmen."
        )
    return None, None


def _most_specific(
    found: list[tuple[ArticleTerm, str, tuple[int, int]]], terms: list[ArticleTerm]
) -> list[tuple[ArticleTerm, str, tuple[int, int]]]:
    """Keep the most specific entries: drop matches inside a longer match of the
    same kind ("welded" in "welded elbow", "certificate" in "certificate of
    origin") and categories matched only on wording shared by several categories
    ("Blech") when another category matched on its own wording (its sheet size)."""
    categories = [item for item in found if item[0].kind is TermKind.CATEGORY]
    shared: set[str] = set()
    seen: set[str] = set()
    for term in terms:
        if term.kind is TermKind.CATEGORY:
            for synonym in {normalize(s) for s in term.synonyms}:
                (shared if synonym in seen else seen).add(synonym)
    specific = [item for item in categories if normalize(item[1]) not in shared]
    result = []
    for item in found:
        term, matched, (start, end) = item
        inside_longer = any(
            other is not item
            and other[0].kind is term.kind
            and other[2][0] <= start
            and end <= other[2][1]
            and (other[2][1] - other[2][0]) > (end - start)
            for other in found
        )
        only_shared = (
            term.kind is TermKind.CATEGORY
            and normalize(matched) in shared
            and bool(specific)
        )
        if not (inside_longer or only_shared):
            result.append(item)
    return result


def resolve_terms(terms: list[ArticleTerm], text: str) -> list[TermMatch]:
    """Find the list entries mentioned in a free text."""
    normalized = normalize(text)
    found = [
        (term, hit[0], hit[1])
        for term in terms
        if not _excluded(term, normalized)
        and (hit := _find(term, normalized)) is not None
    ]
    matches: list[TermMatch] = []
    for term, matched, _ in _most_specific(found, terms):
        pattern, hint = _hint(term)
        matches.append(
            TermMatch(
                kind=term.kind,
                code=term.code,
                matched=matched,
                article_number=term.article_number,
                substitute_for=term.substitute_for,
                matchcode_pattern=pattern,
                hint=hint,
            )
        )
    return matches
