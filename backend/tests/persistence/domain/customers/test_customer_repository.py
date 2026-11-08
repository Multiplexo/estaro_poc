from uuid import uuid4

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from app.persistence import Customer
from app.persistence.domain.customers.customer_repository import CustomerRepository

pytestmark = pytest.mark.integration


async def test_customers_lookup_and_ordered_pagination(
    db_session: AsyncSession,
) -> None:
    records = [
        Customer(customer_number=number, delivery_blocked=False, is_active=True)
        for number in ["C-200", "C-100"]
    ]
    db_session.add_all(records)
    await db_session.flush()
    repository = CustomerRepository(db_session)

    customer = await repository.get_customer(records[1].id)
    assert customer is not None and customer.customer_number == "C-100"
    assert await repository.get_customer(uuid4()) is None
    assert await repository.get_customer_by_number("C-100") == customer
    assert await repository.get_customer_by_number("missing") is None
    assert [
        item.customer_number for item in await repository.list_customers(limit=1)
    ] == ["C-100"]
    assert [
        item.customer_number
        for item in await repository.list_customers(offset=1, limit=1)
    ] == ["C-200"]
    assert await repository.search("   ") == []


@pytest.mark.parametrize("offset,limit", [(-1, 1), (0, 0)])
async def test_rejects_invalid_pagination(
    db_session: AsyncSession, offset: int, limit: int
) -> None:
    repository = CustomerRepository(db_session)
    with pytest.raises(ValueError, match="offset must be non-negative"):
        await repository.list_customers(offset=offset, limit=limit)
