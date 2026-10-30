"""HTTP input models for extraction submission."""

from pydantic import BaseModel, Field


class ExtractionRequest(BaseModel):
    """Optional source reference; dummy steps do not read the object yet."""

    source_key: str | None = Field(default=None, min_length=1, max_length=1024)
