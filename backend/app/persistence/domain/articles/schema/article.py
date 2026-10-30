"""Database schema for articles in the article master data."""

from decimal import Decimal

from sqlalchemy import Text
from sqlmodel import Field, SQLModel

from app.models.domain.articles import Article as ArticleModel


class Article(SQLModel, table=True):
    """Article master data, including inventory, units, and purchasing details."""

    def to_model(self) -> ArticleModel:
        """Map this database record to the application model."""
        return ArticleModel.model_validate(self)

    id: int | None = Field(
        default=None,
        primary_key=True,
        description="The article's database primary key.",
    )
    article_number: str = Field(sa_type=Text, description="The article number.")
    variant: str = Field(
        default="",
        sa_type=Text,
        sa_column_kwargs={"server_default": ""},
        description="The article variant; empty when no variant is specified.",
    )
    matchcode: str | None = Field(
        default=None,
        sa_type=Text,
        index=True,
        description="The search code used to find the article.",
    )
    description_1: str | None = Field(
        default=None, sa_type=Text, description="The primary article description."
    )
    description_2: str | None = Field(
        default=None, sa_type=Text, description="The additional article description."
    )
    sales_unit_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the article's sales unit."
    )
    sales_unit_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the article's sales unit."
    )
    stock_quantity: Decimal = Field(
        max_digits=20,
        decimal_places=6,
        description="The quantity in stock, expressed in the stock unit.",
    )
    weight_kg: Decimal = Field(
        max_digits=20,
        decimal_places=6,
        description="The article's weight in kilograms.",
    )
    stock_unit_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the article's stock unit."
    )
    stock_unit_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the article's stock unit."
    )
    article_group_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the article's group."
    )
    article_group_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the article's group."
    )
    is_active: bool = Field(description="Whether the article is active.")
    commodity_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The commodity classification code used for customs and trade reporting.",
    )
    main_supplier_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code identifying the main supplier.",
    )
    main_storage_location: str | None = Field(
        default=None, sa_type=Text, description="The article's main storage location."
    )
    has_memo: bool = Field(description="Whether the article has an associated memo.")
    manufacturer: str | None = Field(
        default=None, sa_type=Text, description="The article's manufacturer."
    )
    quantity_calculation_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the article's quantity calculation method.",
    )
    quantity_calculation_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The name of the article's quantity calculation method.",
    )
    is_saleable: bool = Field(description="Whether the article can be sold.")
    is_purchasable: bool = Field(description="Whether the article can be purchased.")
    tax_class_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the article's tax class."
    )
    tax_class_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the article's tax class."
    )
    batch_requirement: str | None = Field(
        default=None,
        sa_type=Text,
        description="The article's batch tracking requirement.",
    )
    batch_selection_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the article's batch selection method.",
    )
    batch_selection_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The name of the article's batch selection method.",
    )
    intrastat_net_mass_kg: Decimal | None = Field(
        default=None,
        max_digits=20,
        decimal_places=6,
        description="The net mass in kilograms used for Intrastat reporting.",
    )
    is_exotic: bool | None = Field(
        default=None, description="Whether the article is marked as exotic."
    )
