from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

RuleTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)
]
RuleInstruction = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)
]


class RuleCategory(StrEnum):
    EXTRACTION = "extraction"
    MATCHING = "matching"


class RuleSection(StrEnum):
    CUSTOMER_CONTACT = "customer_contact"
    INQUIRY_DATA = "inquiry_data"
    ARTICLES = "articles"
    CUSTOMER_INFORMATION = "kundeninformationen"
    DOCUMENT_INFORMATION = "beleginformationen"
    DELIVERY_ADDRESS = "lieferadresse"
    BILLING_ADDRESS = "rechnungsadresse"
    HEADER_TEXT = "kopftext"
    DOCUMENT_DETAILS = "belegdetails"
    PRICE_TAX_BASIS = "preisUndSteuerbasis"
    OFFER_DETAILS = "angebotsdetails"
    POSITION = "positionen"


RULE_SECTIONS: dict[RuleCategory, tuple[RuleSection, ...]] = {
    RuleCategory.EXTRACTION: (
        RuleSection.CUSTOMER_CONTACT,
        RuleSection.INQUIRY_DATA,
        RuleSection.ARTICLES,
    ),
    RuleCategory.MATCHING: (
        RuleSection.CUSTOMER_INFORMATION,
        RuleSection.DOCUMENT_INFORMATION,
        RuleSection.DELIVERY_ADDRESS,
        RuleSection.BILLING_ADDRESS,
        RuleSection.HEADER_TEXT,
        RuleSection.DOCUMENT_DETAILS,
        RuleSection.PRICE_TAX_BASIS,
        RuleSection.OFFER_DETAILS,
        RuleSection.POSITION,
    ),
}

RULE_SECTION_LABELS: dict[RuleSection, str] = {
    RuleSection.CUSTOMER_CONTACT: "Kunde & Kontakt",
    RuleSection.INQUIRY_DATA: "Anfragedaten",
    RuleSection.ARTICLES: "Artikel",
    RuleSection.CUSTOMER_INFORMATION: "Kundeninformationen",
    RuleSection.DOCUMENT_INFORMATION: "Beleginformationen",
    RuleSection.DELIVERY_ADDRESS: "Lieferadresse",
    RuleSection.BILLING_ADDRESS: "Rechnungsadresse",
    RuleSection.HEADER_TEXT: "Kopftext",
    RuleSection.DOCUMENT_DETAILS: "Belegdetails",
    RuleSection.PRICE_TAX_BASIS: "Preis- und Steuerbasis",
    RuleSection.OFFER_DETAILS: "Angebotsdetails",
    RuleSection.POSITION: "Position",
}


class RuleRectangle(BaseModel):
    x: float = Field(ge=0, lt=1)
    y: float = Field(ge=0, lt=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def validate_bounds(self) -> "RuleRectangle":
        if self.x + self.width > 1.000001 or self.y + self.height > 1.000001:
            raise ValueError("Markierung muss innerhalb der PDF-Seite liegen")
        return self


class RuleSource(BaseModel):
    inquiry_id: UUID | None = None
    document_id: UUID | None = None
    page: int = Field(ge=1)
    quote: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)
    ]
    rectangles: list[RuleRectangle] = Field(min_length=1, max_length=500)


class RuleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: RuleTitle
    instruction: RuleInstruction
    category: RuleCategory
    section: RuleSection | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_section(self) -> "RuleUpdate":
        if (
            self.section is not None
            and self.section not in RULE_SECTIONS[self.category]
        ):
            raise ValueError("Die Kategorie gehört nicht zum gewählten Bereich.")
        return self


class RuleCreate(RuleUpdate):
    source: RuleSource | None = None


class Rule(RuleCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime
