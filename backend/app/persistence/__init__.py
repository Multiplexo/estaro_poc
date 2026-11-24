"""This file contains the database schemas for the application."""

from app.persistence.domain.articles import Article
from app.persistence.domain.customers import Customer
from app.persistence.domain.feedback.schema.feedback import Feedback
from app.persistence.domain.inquiries import (
    Inquiry,
    InquiryDocument,
    InquiryExtraction,
    InquiryImport,
)
from app.persistence.domain.outlook.schema.mailbox import OutlookMailbox
from app.persistence.domain.rules.schema.rule import Rule
from app.persistence.domain.terms.schema.term import ArticleTerm
from app.persistence.jobs.extractions.schema.extraction_job import ExtractionJob
from app.persistence.jobs.matching.schema.matching_job import MatchingJob
from app.persistence.jobs.usage.schema.ai_usage import AIUsage

__all__ = [
    "AIUsage",
    "Article",
    "ArticleTerm",
    "Customer",
    "ExtractionJob",
    "Feedback",
    "Inquiry",
    "InquiryDocument",
    "InquiryExtraction",
    "InquiryImport",
    "MatchingJob",
    "OutlookMailbox",
    "Rule",
]
