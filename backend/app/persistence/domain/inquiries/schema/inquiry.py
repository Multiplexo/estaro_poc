"""Database schemas for inquiries and their documents."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, Index, Text, text
from sqlmodel import Field, Relationship, SQLModel

from app.models.domain.inquiries import FileType
from app.models.domain.inquiries import Inquiry as InquiryModel
from app.models.domain.inquiries import InquiryDocument as InquiryDocumentModel


class Inquiry(SQLModel, table=True):
    """Inquiry lifecycle and associated documents."""

    def to_model(self) -> InquiryModel:
        """Map an inquiry with its eagerly loaded documents."""
        return InquiryModel(
            id=self.id,
            created_at=self.created_at,
            deletion_requested_at=self.deletion_requested_at,
            deletion_retry_at=self.deletion_retry_at,
            documents=[document.to_model() for document in self.documents],
        )

    # SQLModel types this attribute as a descriptor, but accepts string table names.
    __tablename__ = "inquiry"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        Index("inquiry_created_at_id_idx", "created_at", "id"),
        Index(
            "inquiry_pending_deletion_idx",
            "deletion_retry_at",
            postgresql_where=text("deletion_requested_at IS NOT NULL"),
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(sa_type=DateTime(timezone=True))
    deletion_requested_at: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)
    )
    deletion_retry_at: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)
    )
    documents: list["InquiryDocument"] = Relationship(
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "lazy": "raise",
            "order_by": "InquiryDocument.filename, InquiryDocument.id",
        }
    )


class InquiryDocument(SQLModel, table=True):
    """An inquiry file and its optional parent file."""

    def to_model(self) -> InquiryDocumentModel:
        """Map this database record to the application model."""
        return InquiryDocumentModel.model_validate(self)

    __tablename__ = "inquiry_document"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    inquiry_id: UUID = Field(foreign_key="inquiry.id", ondelete="CASCADE", index=True)
    filename: str = Field(sa_type=Text)
    parent_document_id: UUID | None = Field(
        default=None, foreign_key="inquiry_document.id", ondelete="CASCADE"
    )
    file_type: FileType = Field(
        sa_type=Enum(
            FileType,
            name="file_type",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda types: [file_type.value for file_type in types],
        )
    )
