"""Inquiry data models, independent of database mappings."""

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.models.domain.extraction_review import ExtractionReview
from app.models.domain.inquiry_data import InquiryData
from app.models.jobs.extraction import InquiryExtraction
from app.models.shared.pagination import Pagination


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
    source_key: str | None = Field(default=None, max_length=1024)


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
    daten: InquiryData = Field(default_factory=InquiryData)
    documents: list[InquiryDocument] = Field(default_factory=list)


class InquiryExtractionSnapshot(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    inquiry_id: UUID
    job_id: UUID | None
    created_at: datetime
    schema_version: int
    model: str
    prompt_version: str
    result: InquiryExtraction
    review: ExtractionReview = Field(default_factory=ExtractionReview)


class InquiryOverviewQuery(Pagination):
    search: str = Field(default="", max_length=1000)
    sort: Literal["newest", "oldest", "customer"] = "newest"
    status: Literal["all", "new", "in_review", "reviewed"] = "all"


class InquiryOverview(Inquiry):
    latest_extraction: InquiryExtractionSnapshot


class InquiryOverviewPage(BaseModel):
    items: list[InquiryOverview]
    total: int
