"""This file contains the database schemas for the application."""

from app.persistence.domain.articles import Article
from app.persistence.domain.customers import Customer
from app.persistence.domain.inquiries import Inquiry, InquiryDocument, InquiryExtraction
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob

__all__ = [
    "Article",
    "Customer",
    "ExtractionJob",
    "Inquiry",
    "InquiryDocument",
    "InquiryExtraction",
]
