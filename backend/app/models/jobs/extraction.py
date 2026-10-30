"""Extraction job lifecycle and progress shared by the API and worker."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ExtractionStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class ExtractionJobStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_key: str | None
    status: ExtractionStatus
    current_step: str | None
    completed_steps: int
    total_steps: int = 4
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
