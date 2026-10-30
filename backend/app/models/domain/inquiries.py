"""Inquiry data models, independent of database mappings."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class FileType(StrEnum):
    PDF = "pdf"
    MSG = "msg"

    @property
    def media_type(self) -> str:
        return {
            FileType.PDF: "application/pdf",
            FileType.MSG: "application/vnd.ms-outlook",
        }[self]


class InquiryDocument(BaseModel):
    """A file belonging to an inquiry, optionally extracted from another file."""

    model_config = ConfigDict(
        from_attributes=True, extra="forbid", revalidate_instances="always"
    )

    id: UUID = Field(default_factory=uuid4, description="The document's UUID.")
    inquiry_id: UUID = Field(description="The inquiry owning this document.")
    filename: str = Field(description="The document's filename.")
    parent_document_id: UUID | None = Field(
        default=None, description="The source document's UUID, if any."
    )
    file_type: FileType = Field(description="The document's file format.")


class Inquiry(BaseModel):
    """An inquiry with its ordered documents."""

    model_config = ConfigDict(
        from_attributes=True, extra="forbid", revalidate_instances="always"
    )

    id: UUID = Field(default_factory=uuid4, description="The inquiry's UUID.")
    created_at: datetime = Field(description="When the inquiry was created.")
    deletion_requested_at: datetime | None = Field(
        default=None, description="When deletion was requested, if any."
    )
    deletion_retry_at: datetime | None = Field(
        default=None, description="When to retry deletion, if scheduled."
    )
    documents: list[InquiryDocument] = Field(default_factory=list)
