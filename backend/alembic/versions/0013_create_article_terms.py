"""Create the article designation list (synonyms for matching)."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "article_term",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column(
            "synonyms",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("article_number", sa.Text(), nullable=True),
        sa.Column("substitute_for", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "kind",
            "code",
            "substitute_for",
            name="uq_article_term",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_index("ix_article_term_kind", "article_term", ["kind"])


def downgrade() -> None:
    op.drop_index("ix_article_term_kind", table_name="article_term")
    op.drop_table("article_term")
