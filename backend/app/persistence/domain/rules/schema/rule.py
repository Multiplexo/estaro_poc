from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.domain.rules import Rule as RuleModel
from app.models.domain.rules import RuleCategory, RuleRectangle, RuleSection, RuleSource


class Rule(SQLModel, table=True):
    __tablename__ = "feedback_rule"  # pyright: ignore[reportAssignmentType]
    __table_args__ = (
        CheckConstraint(
            "section IS NULL OR "
            "(category = 'extraction' AND section IN "
            "('customer_contact', 'inquiry_data', 'articles')) OR "
            "(category = 'matching' AND section IN "
            "('kundeninformationen', 'beleginformationen', 'lieferadresse', "
            "'rechnungsadresse', 'kopftext', 'belegdetails', "
            "'preisUndSteuerbasis', 'angebotsdetails', 'positionen'))",
            name="feedback_rule_section_category_check",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str = Field(max_length=160)
    instruction: str = Field(sa_type=Text)
    category: RuleCategory = Field(
        sa_type=Enum(
            RuleCategory,
            name="rule_category",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda categories: [
                category.value for category in categories
            ],
        ),
        index=True,
    )
    is_active: bool = True
    section: str | None = Field(default=None, max_length=40)
    inquiry_id: UUID | None = Field(
        default=None, foreign_key="inquiry.id", ondelete="SET NULL"
    )
    document_id: UUID | None = Field(
        default=None, foreign_key="inquiry_document.id", ondelete="SET NULL", index=True
    )
    source_page: int | None = None
    source_quote: str | None = Field(default=None, sa_type=Text)
    source_rectangles: list[dict[str, float]] = Field(
        default_factory=list, sa_type=JSONB
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC), sa_type=DateTime(timezone=True)
    )

    def to_model(self) -> RuleModel:
        source = None
        if self.source_page is not None and self.source_quote is not None:
            source = RuleSource(
                inquiry_id=self.inquiry_id,
                document_id=self.document_id,
                page=self.source_page,
                quote=self.source_quote,
                rectangles=[
                    RuleRectangle.model_validate(rectangle)
                    for rectangle in self.source_rectangles
                ],
            )
        return RuleModel(
            id=self.id,
            title=self.title,
            instruction=self.instruction,
            category=self.category,
            section=RuleSection(self.section) if self.section is not None else None,
            is_active=self.is_active,
            source=source,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
