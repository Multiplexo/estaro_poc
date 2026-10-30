"""Create articles.

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the resource tables and indexes."""
    op.create_table(
        "article",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("article_number", sa.Text(), nullable=False),
        sa.Column("variant", sa.Text(), server_default="", nullable=False),
        sa.Column("matchcode", sa.Text(), nullable=True),
        sa.Column("description_1", sa.Text(), nullable=True),
        sa.Column("description_2", sa.Text(), nullable=True),
        sa.Column("sales_unit_code", sa.Text(), nullable=True),
        sa.Column("sales_unit_name", sa.Text(), nullable=True),
        sa.Column("stock_quantity", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("weight_kg", sa.Numeric(precision=20, scale=6), nullable=False),
        sa.Column("stock_unit_code", sa.Text(), nullable=True),
        sa.Column("stock_unit_name", sa.Text(), nullable=True),
        sa.Column("article_group_code", sa.Text(), nullable=True),
        sa.Column("article_group_name", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("commodity_code", sa.Text(), nullable=True),
        sa.Column("main_supplier_code", sa.Text(), nullable=True),
        sa.Column("main_storage_location", sa.Text(), nullable=True),
        sa.Column("has_memo", sa.Boolean(), nullable=False),
        sa.Column("manufacturer", sa.Text(), nullable=True),
        sa.Column("quantity_calculation_code", sa.Text(), nullable=True),
        sa.Column("quantity_calculation_name", sa.Text(), nullable=True),
        sa.Column("is_saleable", sa.Boolean(), nullable=False),
        sa.Column("is_purchasable", sa.Boolean(), nullable=False),
        sa.Column("tax_class_code", sa.Text(), nullable=True),
        sa.Column("tax_class_name", sa.Text(), nullable=True),
        sa.Column("batch_requirement", sa.Text(), nullable=True),
        sa.Column("batch_selection_code", sa.Text(), nullable=True),
        sa.Column("batch_selection_name", sa.Text(), nullable=True),
        sa.Column(
            "intrastat_net_mass_kg", sa.Numeric(precision=20, scale=6), nullable=True
        ),
        sa.Column("is_exotic", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_article_matchcode"), "article", ["matchcode"], unique=False
    )


def downgrade() -> None:
    """Remove the resource tables and indexes."""
    op.drop_index(op.f("ix_article_matchcode"), table_name="article")
    op.drop_table("article")
