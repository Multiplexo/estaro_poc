"""Create inquiries.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the resource tables and indexes."""
    op.create_table(
        "inquiry",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deletion_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "inquiry_created_at_id_idx", "inquiry", ["created_at", "id"], unique=False
    )
    op.create_index(
        "inquiry_pending_deletion_idx",
        "inquiry",
        ["deletion_retry_at"],
        unique=False,
        postgresql_where=sa.text("deletion_requested_at IS NOT NULL"),
    )
    op.create_table(
        "inquiry_document",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("parent_document_id", sa.Uuid(), nullable=True),
        sa.Column(
            "file_type",
            sa.Enum(
                "pdf",
                "msg",
                name="file_type",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiry.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["parent_document_id"], ["inquiry_document.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_inquiry_document_inquiry_id"),
        "inquiry_document",
        ["inquiry_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the resource tables and indexes."""
    op.drop_index(op.f("ix_inquiry_document_inquiry_id"), table_name="inquiry_document")
    op.drop_table("inquiry_document")
    op.drop_index(
        "inquiry_pending_deletion_idx",
        table_name="inquiry",
        postgresql_where=sa.text("deletion_requested_at IS NOT NULL"),
    )
    op.drop_index("inquiry_created_at_id_idx", table_name="inquiry")
    op.drop_table("inquiry")
