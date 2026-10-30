"""Run dummy steps in order and report progress to the caller."""

from collections.abc import Awaitable, Callable

from app.pipelines.extraction.extract import extract_fields
from app.pipelines.extraction.load import load_document
from app.pipelines.extraction.parse import parse_document
from app.pipelines.extraction.validate import validate_fields

STEPS = (
    ("load", load_document),
    ("parse", parse_document),
    ("extract", extract_fields),
    ("validate", validate_fields),
)


async def run_pipeline(report_progress: Callable[[str, int], Awaitable[None]]) -> None:
    """The steps currently only print; no document or LLM calls are made."""
    for completed_steps, (name, step) in enumerate(STEPS):
        await report_progress(name, completed_steps)
        step()
        await report_progress(name, completed_steps + 1)
