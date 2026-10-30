"""HTTP input models for extraction submission."""

from uuid import UUID

from pydantic import BaseModel, Field


class ExtractionRequest(BaseModel):
    """Stored PDF reference used to create an extraction job."""

    source_key: str = Field(min_length=1, max_length=1024)
    document_id: UUID
    filename: str = Field(min_length=1)
