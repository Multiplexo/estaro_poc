"""This file contains the data models for the application."""

from app.models.api.health import RootResponse
from app.models.domain.articles import Article
from app.models.domain.customers import Customer
from app.models.domain.inquiries import FileType, Inquiry, InquiryDocument
from app.models.shared.pagination import Pagination

__all__ = [
    "Article",
    "Customer",
    "FileType",
    "Inquiry",
    "InquiryDocument",
    "Pagination",
    "RootResponse",
]
