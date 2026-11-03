import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("feedback_rule", sa.Column("section", sa.String(40), nullable=True))
    op.create_check_constraint(
        "feedback_rule_section_category_check",
        "feedback_rule",
        "section IS NULL OR "
        "(category = 'extraction' AND section IN "
        "('customer_contact', 'inquiry_data', 'articles')) OR "
        "(category = 'matching' AND section IN "
        "('kundeninformationen', 'beleginformationen', 'lieferadresse', "
        "'rechnungsadresse', 'kopftext', 'belegdetails', "
        "'preisUndSteuerbasis', 'angebotsdetails', 'positionen'))",
    )


def downgrade() -> None:
    op.drop_constraint(
        "feedback_rule_section_category_check", "feedback_rule", type_="check"
    )
    op.drop_column("feedback_rule", "section")
