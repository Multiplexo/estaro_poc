"""Async customer queries and schema-to-model mapping."""

from uuid import UUID

from sqlalchemy import func, or_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.domain.customers import Customer
from app.persistence.domain.customers.schema.customer import Customer as CustomerSchema


class CustomerRepository:
    """Retrieve customers through an injected async session."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_customer(self, customer_id: UUID) -> Customer | None:
        """Return a customer by ID, or None when absent."""
        record = await self.session.get(CustomerSchema, customer_id)
        return record.to_model() if record is not None else None

    async def get_customer_by_number(self, customer_number: str) -> Customer | None:
        """Return a customer matching its business number."""
        statement = select(CustomerSchema).where(
            CustomerSchema.customer_number == customer_number,
        )
        record = (await self.session.exec(statement)).one_or_none()
        return record.to_model() if record is not None else None

    async def list_customers(self, offset: int = 0, limit: int = 100) -> list[Customer]:
        """Return a consistently ordered page of customers."""
        if offset < 0 or limit < 1:
            raise ValueError("offset must be non-negative and limit must be positive")

        statement = (
            select(CustomerSchema)
            .order_by(col(CustomerSchema.customer_number))
            .offset(offset)
            .limit(limit)
        )
        records = (await self.session.exec(statement)).all()
        return [record.to_model() for record in records]

    async def search(self, query: str, limit: int = 15) -> list[Customer]:
        query = query.strip()[:200]
        if not query:
            return []
        text = func.concat_ws(
            " ",
            CustomerSchema.customer_number,
            CustomerSchema.matchcode,
            CustomerSchema.name,
            CustomerSchema.name_addition,
            CustomerSchema.city,
            CustomerSchema.postal_code,
        )
        score = func.word_similarity(query, text)
        statement = (
            select(CustomerSchema)
            .where(or_(score > 0.15, text.icontains(query, autoescape=True)))
            .order_by(
                (col(CustomerSchema.customer_number) == query).desc(),
                score.desc(),
                CustomerSchema.customer_number,
            )
            .limit(min(max(limit, 1), 30))
        )
        return [
            record.to_model() for record in (await self.session.exec(statement)).all()
        ]
