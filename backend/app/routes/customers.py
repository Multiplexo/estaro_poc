"""GET endpoints for customers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_customer_repository
from app.models.domain.customers import Customer
from app.models.shared.pagination import Pagination
from app.persistence.domain.customers.customer_repository import CustomerRepository

router = APIRouter()
RepositoryDep = Annotated[CustomerRepository, Depends(get_customer_repository)]


@router.get("", response_model=list[Customer], operation_id="list_customers")
async def list_customers(
    repository: RepositoryDep,
    pagination: Annotated[Pagination, Depends()],
) -> list[Customer]:
    """Return a page of customers."""
    return await repository.list_customers(
        offset=pagination.offset, limit=pagination.limit
    )


@router.get(
    "/{customer_id}", response_model=Customer, operation_id="get_customer_by_id"
)
async def get_customer_by_id(customer_id: UUID, repository: RepositoryDep) -> Customer:
    """Return a customer by ID."""
    customer = await repository.get_customer(customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    return customer
