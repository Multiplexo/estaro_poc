"""Track token usage of AI runs for cost transparency."""

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "ai_usage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("job_kind", sa.Text(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=True),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("succeeded", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiry.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_usage_created_at", "ai_usage", ["created_at"])
    op.create_index("ix_ai_usage_inquiry_id", "ai_usage", ["inquiry_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_usage_inquiry_id", table_name="ai_usage")
    op.drop_index("ix_ai_usage_created_at", table_name="ai_usage")
    op.drop_table("ai_usage")
