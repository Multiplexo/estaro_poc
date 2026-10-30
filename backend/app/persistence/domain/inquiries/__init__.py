"""This file contains the database schemas for inquiries and their documents."""

from app.persistence.domain.inquiries.schema.inquiry import Inquiry, InquiryDocument
from app.persistence.domain.inquiries.schema.inquiry_extraction import InquiryExtraction

__all__ = [
    "Inquiry",
    "InquiryDocument",
    "InquiryExtraction",
]
