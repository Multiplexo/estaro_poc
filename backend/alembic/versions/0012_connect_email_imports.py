import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_constraint("file_type", "inquiry_document", type_="check")
    op.create_check_constraint(
        "file_type", "inquiry_document", "file_type IN ('pdf', 'msg', 'eml')"
    )
    op.create_table(
        "inquiry_import",
        sa.Column("import_key", sa.String(length=1024), nullable=False),
        sa.Column("inquiry_id", sa.Uuid(), nullable=True),
        sa.Column("prepared", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["inquiry_id"], ["inquiry.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("import_key"),
        sa.UniqueConstraint("inquiry_id"),
    )


def downgrade() -> None:
    op.drop_constraint("file_type", "inquiry_document", type_="check")
    op.create_check_constraint(
        "file_type", "inquiry_document", "file_type IN ('pdf', 'msg')"
    )
    op.drop_table("inquiry_import")
