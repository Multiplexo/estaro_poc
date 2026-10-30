"""GET endpoints for inquiries."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_inquiry_repository
from app.models.domain.inquiries import Inquiry
from app.models.shared.pagination import Pagination
from app.persistence.domain.inquiries.inquiry_repository import InquiryRepository

router = APIRouter()
RepositoryDep = Annotated[InquiryRepository, Depends(get_inquiry_repository)]


@router.get("", response_model=list[Inquiry], operation_id="list_inquiries")
async def list_inquiries(
    repository: RepositoryDep,
    pagination: Annotated[Pagination, Depends()],
) -> list[Inquiry]:
    """Return a page of inquiries."""
    return await repository.list_inquiries(
        offset=pagination.offset, limit=pagination.limit
    )


@router.get("/{inquiry_id}", response_model=Inquiry, operation_id="get_inquiry_by_id")
async def get_inquiry_by_id(inquiry_id: UUID, repository: RepositoryDep) -> Inquiry:
    """Return an inquiry by ID."""
    inquiry = await repository.get_inquiry(inquiry_id)
    if inquiry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inquiry not found",
        )
    return inquiry
