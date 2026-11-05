from uuid import UUID

from sqlmodel import Field, SQLModel


class InquiryImport(SQLModel, table=True):
    __tablename__ = "inquiry_import"  # pyright: ignore[reportAssignmentType]

    import_key: str = Field(primary_key=True, max_length=1024)
    inquiry_id: UUID | None = Field(
        default=None, foreign_key="inquiry.id", ondelete="SET NULL", unique=True
    )
    prepared: bool = False
