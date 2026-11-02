"""Extraction job lifecycle and progress shared by the API and worker."""

from collections.abc import Iterator
from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

INQUIRY_EXTRACTION_SCHEMA_VERSION = 3


class CitationBBox(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    l: float
    t: float
    r: float
    b: float
    coord_origin: Literal["TOPLEFT"] = "TOPLEFT"


class CitationSource(BaseModel):
    page_number: int = Field(ge=1)
    page_width: float = Field(gt=0)
    page_height: float = Field(gt=0)
    bbox: CitationBBox


class ClassifiedDocument(BaseModel):
    doctags: str
    page_images: list[str] = Field(min_length=1)
    sources: dict[str, CitationSource]


class ExtractionStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class ExtractionJobStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_key: str | None
    inquiry_id: UUID | None
    document_id: UUID | None
    status: ExtractionStatus
    current_step: str | None
    completed_steps: int
    total_steps: int = 4
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ExtractionSchema(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class Citation(ExtractionSchema):
    """Wörtlicher Beleg aus einem der bereitgestellten Quellabschnitte."""

    document_id: str = Field(
        min_length=1,
        max_length=100,
        description=(
            "Die UUID aus document_id der Quelle exakt übernehmen; "
            "niemals den Dateinamen verwenden."
        ),
    )
    section_id: str = Field(
        min_length=1,
        max_length=200,
        description="Exakte section_id aus diesem Dokument, z. B. page-1-item-3-prov-1.",
    )
    quote: str = Field(
        min_length=1,
        max_length=2000,
        description=(
            "Kleinster wörtlicher Textausschnitt, der dieses Feld belegt; "
            "nicht die gesamte Zeile. Schreibweise und Leerzeichen beibehalten."
        ),
    )
    bbox: CitationBBox | None = None
    page_number: int | None = Field(default=None, ge=1)
    page_width: float | None = Field(default=None, gt=0)
    page_height: float | None = Field(default=None, gt=0)


class ExtractedField(ExtractionSchema):
    """Ein extrahierter Wert mit seinen wörtlichen Quellenbelegen."""

    value: str | None = Field(
        max_length=1000,
        description=(
            "Lesbarer extrahierter Wert in der ursprünglichen Einheit. "
            "Fehlende Einheiten nicht ergänzen und Mengen nicht umrechnen. "
            "null, wenn die Angabe in den Quellen fehlt."
        ),
    )
    citations: list[Citation] = Field(
        max_length=8,
        description=(
            "Mindestens ein wörtlicher Beleg für jeden vorhandenen Wert. "
            "Bei Widersprüchen alle abweichenden Quellenangaben belegen. "
            "Nur bei fehlenden Angaben leer lassen."
        ),
    )
    status: Literal["present", "missing", "conflict"] = Field(
        description=(
            "present bei belegten Angaben; missing bei fehlenden Angaben; "
            "conflict bei widersprüchlichen Quellen. Bei Widersprüchen beide "
            "Werte und ihre Belege beibehalten."
        )
    )
    note: str | None = Field(
        default=None,
        max_length=300,
        description=(
            "Ein kurzer deutscher Satz zu fehlenden oder widersprüchlichen "
            "Angaben. Andernfalls null; keine Überlegungen ausgeben."
        ),
    )


class ExtractedItem(ExtractionSchema):
    """Eine angefragte Position, getrennt von den übrigen Positionen."""

    bezeichnung: ExtractedField = Field(
        validation_alias=AliasChoices("bezeichnung", "article"),
        default_factory=lambda: missing_extracted_field(),
        description=(
            "Artikelart und ausdrückliche Ausführung, z. B. nahtloses Rohr, "
            "geschweißtes Rohr, Rundstahl oder Rohrbogen. Kunden-Artikelnummern "
            "sind keine ESTARO-Artikelnummern."
        ),
    )
    werkstoff: ExtractedField = Field(
        validation_alias=AliasChoices("werkstoff", "material"),
        default_factory=lambda: missing_extracted_field(),
        description="Werkstoffgüte, z. B. 1.4841.",
    )
    dimensionstext: ExtractedField = Field(
        validation_alias=AliasChoices("dimensionstext", "dimensions"),
        default_factory=lambda: missing_extracted_field(),
        description=(
            "Benannte Abmessungen: Außendurchmesser, Wandstärke, Breite, Dicke, "
            "Länge bzw. Längenbereich und Fixlänge, jeweils mit belegter Einheit. "
            "Handels-/Herstelllänge ohne Zahlenwert nicht zu einer festen "
            "Länge ergänzen."
        ),
    )
    menge: ExtractedField = Field(
        validation_alias=AliasChoices("menge", "quantity"),
        default_factory=lambda: missing_extracted_field(),
        description=(
            "Ausgewiesene Bestellmenge der Position. Meter-/Kilogrammmenge "
            "von Stabanzahl, Stücklänge, Einzelgewicht und Gesamtgewicht trennen. "
            "Alternative Mengen gehören zu alternativen."
        ),
    )
    mengeneinheit: ExtractedField = Field(
        validation_alias=AliasChoices("mengeneinheit", "unit"),
        default_factory=lambda: missing_extracted_field(),
        description="Mengeneinheit, z. B. m, Stück oder kg. Keine Umrechnung.",
    )
    langtext: ExtractedField = Field(
        validation_alias=AliasChoices("langtext", "requirements"),
        default_factory=lambda: missing_extracted_field(),
        description=(
            "Normen, Toleranzen, Stabanzahl, Qualität, Charge, Prüfungen, "
            "Kennzeichnung, verbotene Ursprünge, Verpackung und Kundenwünsche. "
            "Bedingte Anforderungen ausdrücklich als bedingt wiedergeben."
        ),
    )
    alternativen: ExtractedField = Field(
        validation_alias=AliasChoices("alternativen", "alternatives"),
        default_factory=lambda: missing_extracted_field(),
        description="Ausdrücklich angefragte Alternativen für dieselbe Position.",
    )
    zeugnis: ExtractedField = Field(
        validation_alias=AliasChoices("zeugnis", "certificates"),
        default_factory=lambda: missing_extracted_field(),
        description=(
            "Ausdrücklich angefragte Zertifikate: APZ/WAZ/3.1, Ursprungszeugnis, "
            "Umstempelbescheinigung oder Lieferantenerklärung. Diese Dokumentarten "
            "nicht gleichsetzen; Negationen und Bedingungen erhalten."
        ),
    )


def missing_extracted_field() -> ExtractedField:
    return ExtractedField(value=None, status="missing", citations=[])


class ExtractedCustomer(ExtractionSchema):
    name: ExtractedField = Field(
        validation_alias=AliasChoices("name", "customer"),
        default_factory=missing_extracted_field,
        description=(
            "Ursprünglich anfragendes Unternehmen aus Signatur oder PDF-Absender. "
            "Niemals ESTARO oder einen internen Weiterleiter angeben."
        ),
    )
    kunde: ExtractedField = Field(
        validation_alias=AliasChoices("kunde", "customer_number"),
        default_factory=missing_extracted_field,
        description=(
            "Ausdrücklich dem anfragenden Kunden zugeordnete ESTARO-Kundennummer. "
            "Keine Lieferantennummer, Empfänger-Kundennummer oder Divers-Vorgabe."
        ),
    )
    ort: ExtractedField = Field(
        validation_alias=AliasChoices("ort", "customer_location"),
        default_factory=missing_extracted_field,
        description="Ort/Standort des anfragenden Unternehmens, nicht der Lieferort.",
    )
    ansprechpartner: ExtractedField = Field(
        validation_alias=AliasChoices("ansprechpartner", "contact_name"),
        default_factory=missing_extracted_field,
        description=(
            "Name des zuständigen Ansprechpartners beim anfragenden Kunden "
            "aus Nachricht, Signatur oder 'Ihr Zeichen'. Kein ESTARO-Mitarbeiter."
        ),
    )
    email: ExtractedField = Field(
        validation_alias=AliasChoices("email", "contact_email"),
        default_factory=missing_extracted_field,
        description=(
            "E-Mail-Adresse des Kunden-Ansprechpartners; ersatzweise ausdrücklich "
            "zugehörige Kunden-Kontaktadresse. Kein interner Weiterleiter."
        ),
    )
    telefon: ExtractedField = Field(
        validation_alias=AliasChoices("telefon", "contact_phone"),
        default_factory=missing_extracted_field,
        description=(
            "Telefon/Mobilnummer des Kunden-Ansprechpartners, ggf. gekennzeichnete "
            "Faxnummer. Bei mehreren Nummern deren Zuordnung erhalten."
        ),
    )


class InquiryExtraction(ExtractionSchema):
    """Eingehende ESTARO-Anfrage mit wörtlichen Belegen für jedes extrahierte Feld."""

    @model_validator(mode="before")
    @classmethod
    def read_previous_result(cls, value: object) -> object:
        if not isinstance(value, dict) or "customer" not in value:
            return value
        result = dict(value)
        result["kundeninformationen"] = {
            name: result.pop(name) for name in CUSTOMER_FIELD_NAMES if name in result
        }
        return result

    kundeninformationen: ExtractedCustomer = Field(
        default_factory=lambda: ExtractedCustomer()
    )
    anfragenummer: ExtractedField = Field(
        validation_alias=AliasChoices("anfragenummer", "inquiry_number"),
        default_factory=missing_extracted_field,
        description=(
            "Explizite Anfragenummer des Kunden, auch unter 'Ihre Belegnummer'. "
            "Keine Bestell-, Zeichnungs-, Angebots- oder Positionsnummer."
        ),
    )
    ihreBelegnummer: ExtractedField = Field(
        validation_alias=AliasChoices("ihreBelegnummer", "document_number"),
        default_factory=missing_extracted_field,
        description=(
            "Kundenreferenz für 'Ihre Belegnummer': Anfragenummer übernehmen, "
            "sofern keine separate Kunden-Belegnummer angegeben ist. "
            "Keine interne ESTARO-Angebotsnummer und keine erfundenen Platzhalter."
        ),
    )
    angebotGueltigBis: ExtractedField = Field(
        validation_alias=AliasChoices("angebotGueltigBis", "offer_valid_until"),
        default_factory=missing_extracted_field,
        description=(
            "Ausdrücklich genannte Angebotsgültigkeit als Datum oder Zeitraum. "
            "Von Angebotsabgabefrist und Liefertermin trennen. Keine interne "
            "1-Tag-Vorgabe übernehmen oder ein Datum berechnen."
        ),
    )
    belegZu: ExtractedField = Field(
        validation_alias=AliasChoices("belegZu", "reference_number"),
        default_factory=missing_extracted_field,
        description=(
            "Weitere ausdrücklich benannte Referenzen mit Typ, z. B. Bestell- "
            "oder Zeichnungsnummer. Die Anfragenummer separat erfassen."
        ),
    )
    positionen: list[ExtractedItem] = Field(
        validation_alias=AliasChoices("positionen", "items"),
        default_factory=list,
        max_length=100,
        description="Jede angefragte Position einzeln; keine Positionen erfinden.",
    )
    kopftext: ExtractedField = Field(
        validation_alias=AliasChoices("kopftext", "requirements"),
        default_factory=missing_extracted_field,
        description="Anforderungen und Wünsche, die für die gesamte Anfrage gelten.",
    )
    lieferdatum: ExtractedField = Field(
        validation_alias=AliasChoices("lieferdatum", "delivery_date"),
        default_factory=lambda: ExtractedField(
            value=None, status="missing", citations=[]
        ),
        description=(
            "Ausdrücklich gewünschter Liefertermin oder Lieferzeitraum, auch je "
            "Position mit Positionsbezug. Originalangabe erhalten, z. B. KW 48 "
            "oder schnellstmöglich. Keine Frist aus dem Dokumentdatum ableiten."
        ),
    )


FieldStatus = Literal["present", "missing", "conflict", "unverified"]


CUSTOMER_FIELD_NAMES = {
    "customer": "name",
    "customer_number": "kunde",
    "customer_location": "ort",
    "contact_name": "ansprechpartner",
    "contact_email": "email",
    "contact_phone": "telefon",
}
INQUIRY_FIELD_NAMES = {
    "inquiry_number": "anfragenummer",
    "document_number": "ihreBelegnummer",
    "offer_valid_until": "angebotGueltigBis",
    "reference_number": "belegZu",
    "requirements": "kopftext",
    "delivery_date": "lieferdatum",
}
POSITION_FIELD_NAMES = {
    "article": "bezeichnung",
    "material": "werkstoff",
    "dimensions": "dimensionstext",
    "quantity": "menge",
    "unit": "mengeneinheit",
    "requirements": "langtext",
    "alternatives": "alternativen",
    "certificates": "zeugnis",
}


def extraction_fields(
    result: InquiryExtraction,
) -> Iterator[tuple[str, ExtractedField]]:
    for field_id, name in CUSTOMER_FIELD_NAMES.items():
        yield field_id, getattr(result.kundeninformationen, name)
    for field_id, name in INQUIRY_FIELD_NAMES.items():
        yield field_id, getattr(result, name)
    for index, position in enumerate(result.positionen):
        for field_id, name in POSITION_FIELD_NAMES.items():
            yield f"item-{index}-{field_id}", getattr(position, name)


def extraction_field_ids(result: InquiryExtraction) -> set[str]:
    return {name for name, _ in extraction_fields(result)}
