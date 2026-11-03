import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table(
        "matching_job",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("extraction_job_id", sa.Uuid(), nullable=False, unique=True),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "running",
                "succeeded",
                "failed",
                name="matching_status",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("input_revision", sa.Integer(), nullable=False),
        sa.Column("input_data", postgresql.JSONB(), nullable=False),
        sa.Column("source_conflicts", postgresql.JSONB(), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["extraction_job_id"], ["extraction_job.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiry.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_matching_job_inquiry_id", "matching_job", ["inquiry_id"])


def downgrade() -> None:
    op.drop_index("ix_matching_job_inquiry_id", table_name="matching_job")
    op.drop_table("matching_job")
