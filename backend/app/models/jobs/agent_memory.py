from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class ExtractionFeedback(BaseModel):
    id: UUID
    job_id: UUID
    category: Literal["extraction"] = "extraction"
    source_input: str
    confirmed_fields: dict[str, str | None]
    reuse_for_extraction: bool = True
    created_at: datetime
