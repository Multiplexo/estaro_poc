"""Database schema for customer master data."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Text
from sqlmodel import Field, SQLModel

from app.models.domain.customers import Customer as CustomerModel


class Customer(SQLModel, table=True):
    """Customer identity, address, commercial terms, and tax details."""

    def to_model(self) -> CustomerModel:
        """Map this database record to the application model."""
        return CustomerModel.model_validate(self)

    __table_args__ = (
        CheckConstraint("btrim(customer_number) <> ''", name="number_not_blank"),
    )

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        description="The customer's database UUID primary key.",
    )
    customer_number: str = Field(
        sa_type=Text, unique=True, description="The unique, non-blank customer number."
    )
    matchcode: str | None = Field(
        default=None,
        sa_type=Text,
        index=True,
        description="The search code used to find the customer.",
    )
    salutation: str | None = Field(
        default=None, sa_type=Text, description="The customer's salutation."
    )
    name: str | None = Field(
        default=None, sa_type=Text, description="The customer's name."
    )
    name_addition: str | None = Field(
        default=None,
        sa_type=Text,
        description="Additional information for the customer's name.",
    )
    print_process_variant_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the customer's print process variant.",
    )
    address_group_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the customer's address group.",
    )
    address_group_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The name of the customer's address group.",
    )
    country_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the customer's country."
    )
    country_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the customer's country."
    )
    postal_code: str | None = Field(
        default=None, sa_type=Text, description="The customer's postal code."
    )
    city: str | None = Field(
        default=None, sa_type=Text, description="The customer's city."
    )
    phone: str | None = Field(
        default=None, sa_type=Text, description="The customer's telephone number."
    )
    currency_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the customer's currency."
    )
    currency_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the customer's currency."
    )
    payment_terms_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the customer's payment terms.",
    )
    payment_terms_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The name of the customer's payment terms.",
    )
    representative_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code identifying the customer's representative.",
    )
    price_list_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the customer's price list.",
    )
    price_list_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the customer's price list."
    )
    customer_group_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the customer's group."
    )
    customer_group_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the customer's group."
    )
    language_code: str | None = Field(
        default=None, sa_type=Text, description="The code for the customer's language."
    )
    language_name: str | None = Field(
        default=None, sa_type=Text, description="The name of the customer's language."
    )
    delivery_blocked: bool = Field(
        description="Whether deliveries to the customer are blocked."
    )
    vat_id: str | None = Field(
        default=None,
        sa_type=Text,
        description="The customer's VAT identification number.",
    )
    is_active: bool = Field(description="Whether the customer is active.")
    taxation_type_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the customer's taxation type.",
    )
    taxation_type_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The name of the customer's taxation type.",
    )
    admission_date: date | None = Field(
        default=None,
        description="The date the customer was admitted to the customer master data.",
    )
    eu_country_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The EU country code used for tax reporting.",
    )
    eu_country_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The EU country name used for tax reporting.",
    )
    invoice_cycle_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the customer's invoicing cycle.",
    )
    invoice_cycle_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The name of the customer's invoicing cycle.",
    )
    discount_list_code: str | None = Field(
        default=None,
        sa_type=Text,
        description="The code for the customer's discount list.",
    )
    discount_list_name: str | None = Field(
        default=None,
        sa_type=Text,
        description="The name of the customer's discount list.",
    )
