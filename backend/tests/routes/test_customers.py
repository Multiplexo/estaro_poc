from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.dependencies import get_customer_repository
from app.models.domain.customers import Customer
from app.persistence import Customer as CustomerSchema
from app.persistence.domain.customers.customer_repository import CustomerRepository
from tests.types import OverrideDependency


async def test_customer_response(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    repository = override_dependency(get_customer_repository, CustomerRepository)
    customer = Customer(customer_number="C-100", delivery_blocked=False, is_active=True)
    repository.get_customer.return_value = customer
    response = await client.get(f"/customers/{customer.id}")
    assert response.status_code == 200
    assert response.json() == customer.model_dump(mode="json")
    repository.get_customer.assert_awaited_once_with(customer.id)


async def test_list_pagination(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    repository = override_dependency(get_customer_repository, CustomerRepository)
    repository.list_customers.return_value = []
    response = await client.get("/customers", params={"offset": 2, "limit": 5})
    assert response.status_code == 200
    assert response.json() == []
    repository.list_customers.assert_awaited_once_with(offset=2, limit=5)


@pytest.mark.parametrize("query", ["offset=-1", "limit=0", "limit=1001"])
async def test_list_rejects_invalid_pagination(
    client: AsyncClient, override_dependency: OverrideDependency, query: str
) -> None:
    repository = override_dependency(get_customer_repository, CustomerRepository)
    response = await client.get(f"/customers?{query}")
    assert response.status_code == 422
    repository.list_customers.assert_not_awaited()


async def test_missing_customer(
    client: AsyncClient, override_dependency: OverrideDependency
) -> None:
    repository = override_dependency(get_customer_repository, CustomerRepository)
    repository.get_customer.return_value = None
    response = await client.get(f"/customers/{uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Customer not found"}


@pytest.mark.integration
async def test_customer_endpoint_reads_real_repository(
    db_session: AsyncSession, db_client: AsyncClient
) -> None:
    customer = CustomerSchema(
        customer_number="C-100", delivery_blocked=False, is_active=True
    )
    db_session.add(customer)
    await db_session.flush()
    response = await db_client.get(f"/customers/{customer.id}")
    assert response.status_code == 200
    assert response.json() == customer.to_model().model_dump(mode="json")
    response = await db_client.get("/customers?limit=1")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [str(customer.id)]
