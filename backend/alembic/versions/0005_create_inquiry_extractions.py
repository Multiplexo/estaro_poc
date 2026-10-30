"""Create inquiry extraction snapshots and link uploaded documents to jobs.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "inquiry_document", sa.Column("source_key", sa.String(1024), nullable=True)
    )
    op.add_column("extraction_job", sa.Column("inquiry_id", sa.Uuid(), nullable=True))
    op.add_column("extraction_job", sa.Column("document_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "extraction_job_inquiry_id_fkey",
        "extraction_job",
        "inquiry",
        ["inquiry_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "extraction_job_document_id_fkey",
        "extraction_job",
        "inquiry_document",
        ["document_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_extraction_job_inquiry_id"), "extraction_job", ["inquiry_id"]
    )
    op.create_index(
        op.f("ix_extraction_job_document_id"), "extraction_job", ["document_id"]
    )
    op.create_table(
        "inquiry_extraction",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("model", sa.String(200), nullable=False),
        sa.Column("prompt_version", sa.String(100), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=False),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiry.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["extraction_job.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id"),
    )
    op.create_index(
        "inquiry_extraction_created_at_id_idx",
        "inquiry_extraction",
        ["inquiry_id", "created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index(
        "inquiry_extraction_created_at_id_idx", table_name="inquiry_extraction"
    )
    op.drop_table("inquiry_extraction")
    op.drop_index(op.f("ix_extraction_job_document_id"), table_name="extraction_job")
    op.drop_index(op.f("ix_extraction_job_inquiry_id"), table_name="extraction_job")
    op.drop_constraint(
        "extraction_job_document_id_fkey", "extraction_job", type_="foreignkey"
    )
    op.drop_constraint(
        "extraction_job_inquiry_id_fkey", "extraction_job", type_="foreignkey"
    )
    op.drop_column("extraction_job", "document_id")
    op.drop_column("extraction_job", "inquiry_id")
    op.drop_column("inquiry_document", "source_key")
