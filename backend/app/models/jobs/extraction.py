"""Extraction job lifecycle and progress shared by the API and worker."""

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

INQUIRY_EXTRACTION_SCHEMA_VERSION = 1


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

    article: ExtractedField = Field(
        description=(
            "Artikelart und ausdrückliche Ausführung, z. B. nahtloses Rohr, "
            "geschweißtes Rohr, Rundstahl oder Rohrbogen. Kunden-Artikelnummern "
            "sind keine ESTARO-Artikelnummern."
        )
    )
    material: ExtractedField = Field(description="Werkstoffgüte, z. B. 1.4841.")
    dimensions: ExtractedField = Field(
        description=(
            "Benannte Abmessungen: Außendurchmesser, Wandstärke, Breite, Dicke, "
            "Länge bzw. Längenbereich und Fixlänge, jeweils mit belegter Einheit. "
            "Handels-/Herstelllänge ohne Zahlenwert nicht zu einer festen "
            "Länge ergänzen."
        )
    )
    quantity: ExtractedField = Field(
        description=(
            "Ausgewiesene Bestellmenge der Position. Meter-/Kilogrammmenge "
            "von Stabanzahl, Stücklänge, Einzelgewicht und Gesamtgewicht trennen. "
            "Alternative Mengen gehören zu alternatives."
        )
    )
    unit: ExtractedField = Field(
        description="Mengeneinheit, z. B. m, Stück oder kg. Keine Umrechnung."
    )
    requirements: ExtractedField = Field(
        description=(
            "Normen, Toleranzen, Stabanzahl, Qualität, Charge, Prüfungen, "
            "Kennzeichnung, verbotene Ursprünge, Verpackung und Kundenwünsche. "
            "Bedingte Anforderungen ausdrücklich als bedingt wiedergeben."
        )
    )
    alternatives: ExtractedField = Field(
        description="Ausdrücklich angefragte Alternativen für dieselbe Position."
    )
    certificates: ExtractedField = Field(
        description=(
            "Ausdrücklich angefragte Zertifikate: APZ/WAZ/3.1, Ursprungszeugnis, "
            "Umstempelbescheinigung oder Lieferantenerklärung. Diese Dokumentarten "
            "nicht gleichsetzen; Negationen und Bedingungen erhalten."
        )
    )


def missing_extracted_field() -> ExtractedField:
    return ExtractedField(value=None, status="missing", citations=[])


class InquiryExtraction(ExtractionSchema):
    """Eingehende ESTARO-Anfrage mit wörtlichen Belegen für jedes extrahierte Feld."""

    customer: ExtractedField = Field(
        description=(
            "Ursprünglich anfragendes Unternehmen aus Signatur oder PDF-Absender. "
            "Niemals ESTARO oder einen internen Weiterleiter angeben."
        ),
    )
    customer_number: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description=(
            "Ausdrücklich dem anfragenden Kunden zugeordnete ESTARO-Kundennummer. "
            "Keine Lieferantennummer, Empfänger-Kundennummer oder Divers-Vorgabe."
        ),
    )
    customer_location: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description="Ort/Standort des anfragenden Unternehmens, nicht der Lieferort.",
    )
    contact_name: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description=(
            "Name des zuständigen Ansprechpartners beim anfragenden Kunden "
            "aus Nachricht, Signatur oder 'Ihr Zeichen'. Kein ESTARO-Mitarbeiter."
        ),
    )
    contact_email: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description=(
            "E-Mail-Adresse des Kunden-Ansprechpartners; ersatzweise ausdrücklich "
            "zugehörige Kunden-Kontaktadresse. Kein interner Weiterleiter."
        ),
    )
    contact_phone: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description=(
            "Telefon/Mobilnummer des Kunden-Ansprechpartners, ggf. gekennzeichnete "
            "Faxnummer. Bei mehreren Nummern deren Zuordnung erhalten."
        ),
    )
    inquiry_number: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description=(
            "Explizite Anfragenummer des Kunden, auch unter 'Ihre Belegnummer'. "
            "Keine Bestell-, Zeichnungs-, Angebots- oder Positionsnummer."
        ),
    )
    document_number: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description=(
            "Kundenreferenz für 'Ihre Belegnummer': Anfragenummer übernehmen, "
            "sofern keine separate Kunden-Belegnummer angegeben ist. "
            "Keine interne ESTARO-Angebotsnummer und keine erfundenen Platzhalter."
        ),
    )
    offer_valid_until: ExtractedField = Field(
        default_factory=missing_extracted_field,
        description=(
            "Ausdrücklich genannte Angebotsgültigkeit als Datum oder Zeitraum. "
            "Von Angebotsabgabefrist und Liefertermin trennen. Keine interne "
            "1-Tag-Vorgabe übernehmen oder ein Datum berechnen."
        ),
    )
    reference_number: ExtractedField = Field(
        description=(
            "Weitere ausdrücklich benannte Referenzen mit Typ, z. B. Bestell- "
            "oder Zeichnungsnummer. Die Anfragenummer separat erfassen."
        )
    )
    items: list[ExtractedItem] = Field(
        max_length=100,
        description="Jede angefragte Position einzeln; keine Positionen erfinden.",
    )
    requirements: ExtractedField = Field(
        description="Anforderungen und Wünsche, die für die gesamte Anfrage gelten."
    )
    delivery_date: ExtractedField = Field(
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
