"""Create customers.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Create the resource tables and indexes."""
    op.create_table(
        "customer",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_number", sa.Text(), nullable=False),
        sa.Column("matchcode", sa.Text(), nullable=True),
        sa.Column("salutation", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("name_addition", sa.Text(), nullable=True),
        sa.Column("print_process_variant_code", sa.Text(), nullable=True),
        sa.Column("address_group_code", sa.Text(), nullable=True),
        sa.Column("address_group_name", sa.Text(), nullable=True),
        sa.Column("country_code", sa.Text(), nullable=True),
        sa.Column("country_name", sa.Text(), nullable=True),
        sa.Column("postal_code", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("phone", sa.Text(), nullable=True),
        sa.Column("currency_code", sa.Text(), nullable=True),
        sa.Column("currency_name", sa.Text(), nullable=True),
        sa.Column("payment_terms_code", sa.Text(), nullable=True),
        sa.Column("payment_terms_name", sa.Text(), nullable=True),
        sa.Column("representative_code", sa.Text(), nullable=True),
        sa.Column("price_list_code", sa.Text(), nullable=True),
        sa.Column("price_list_name", sa.Text(), nullable=True),
        sa.Column("customer_group_code", sa.Text(), nullable=True),
        sa.Column("customer_group_name", sa.Text(), nullable=True),
        sa.Column("language_code", sa.Text(), nullable=True),
        sa.Column("language_name", sa.Text(), nullable=True),
        sa.Column("delivery_blocked", sa.Boolean(), nullable=False),
        sa.Column("vat_id", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("taxation_type_code", sa.Text(), nullable=True),
        sa.Column("taxation_type_name", sa.Text(), nullable=True),
        sa.Column("admission_date", sa.Date(), nullable=True),
        sa.Column("eu_country_code", sa.Text(), nullable=True),
        sa.Column("eu_country_name", sa.Text(), nullable=True),
        sa.Column("invoice_cycle_code", sa.Text(), nullable=True),
        sa.Column("invoice_cycle_name", sa.Text(), nullable=True),
        sa.Column("discount_list_code", sa.Text(), nullable=True),
        sa.Column("discount_list_name", sa.Text(), nullable=True),
        sa.CheckConstraint("btrim(customer_number) <> ''", name="number_not_blank"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_number"),
    )
    op.create_index(
        op.f("ix_customer_matchcode"), "customer", ["matchcode"], unique=False
    )


def downgrade() -> None:
    """Remove the resource tables and indexes."""
    op.drop_index(op.f("ix_customer_matchcode"), table_name="customer")
    op.drop_table("customer")
