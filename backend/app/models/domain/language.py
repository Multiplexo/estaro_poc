from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

LanguageCode = Annotated[str, Field(pattern=r"^[a-z]{2}$")]


class DetectedLanguage(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    code: LanguageCode | None = Field(
        default=None,
        description=(
            "Automatisch erkannte Hauptsprache des ursprünglichen Kundentexts als "
            "ISO-639-1-Code in Kleinbuchstaben, z. B. de, en oder fr. "
            "null bei nicht bestimmbarer Sprache."
        ),
    )
    confidence: float = Field(
        default=0.0,
        ge=0,
        le=1,
        description="Sicherheit der Spracherkennung von 0 bis 1; 0 bei unbekannter Sprache.",
    )
    additional_codes: list[LanguageCode] = Field(
        default_factory=list,
        max_length=10,
        description=(
            "Weitere im fachlichen Kundentext erkannte Sprachen als ISO-639-1-Codes; "
            "ohne Hauptsprache, Duplikate, Signaturen oder Standardfußzeilen."
        ),
    )
