import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "feedback_rule",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("instruction", sa.Text(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "extraction",
                "matching",
                name="rule_category",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "inquiry_id",
            sa.Uuid(),
            sa.ForeignKey("inquiry.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "document_id",
            sa.Uuid(),
            sa.ForeignKey("inquiry_document.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("source_quote", sa.Text(), nullable=True),
        sa.Column("source_rectangles", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_feedback_rule_category", "feedback_rule", ["category"])
    op.create_index("ix_feedback_rule_document_id", "feedback_rule", ["document_id"])


def downgrade() -> None:
    op.drop_table("feedback_rule")
