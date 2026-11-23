from enum import StrEnum

from pydantic import BaseModel, Field


class TermKind(StrEnum):
    CATEGORY = "category"
    MATERIAL = "material"
    ACCESSORY = "accessory"


class ArticleTerm(BaseModel):
    """One line of estaro's designation list: an internal code and how customers
    write it."""

    kind: TermKind
    code: str = Field(description="estaro designation, e.g. 'nr', '4571', 'WAZ'")
    synonyms: list[str] = Field(default_factory=list)
    article_number: str | None = Field(
        default=None, description="Article for accessories such as certificates"
    )
    substitute_for: str | None = Field(
        default=None,
        description="Material the customer asked for when 'code' is offered instead",
    )


class TermMatch(BaseModel):
    kind: TermKind
    code: str
    matched: str = Field(description="Text in the inquiry that matched")
    article_number: str | None = None
    substitute_for: str | None = None
    matchcode_pattern: str | None = None
    hint: str | None = None
