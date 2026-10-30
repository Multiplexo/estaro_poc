"""HTTP input models for extraction submission."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.domain.extraction_review import ReviewedField


class ExtractionRequest(BaseModel):
    """Stored PDF reference used to create an extraction job."""

    source_key: str = Field(min_length=1, max_length=1024)
    document_id: UUID
    filename: str = Field(min_length=1)


class ExtractionResultUpdate(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    revision: int = Field(ge=0)
    fields: dict[str, ReviewedField] = Field(min_length=1)
