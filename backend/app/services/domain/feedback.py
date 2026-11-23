"""Forward user feedback to the ticket system through a generic JSON webhook."""

import httpx
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.models.domain.feedback import Feedback, FeedbackKind

logger = structlog.get_logger(__name__)

KIND_LABELS = {
    FeedbackKind.BUG: "Fehler",
    FeedbackKind.CHANGE: "Änderungswunsch",
    FeedbackKind.DOMAIN: "Fachliches Feedback",
}
WEBHOOK_TIMEOUT_SECONDS = 5


def webhook_payload(feedback: Feedback, app_url: str) -> dict[str, object]:
    link = f"{app_url}/anfragen/{feedback.inquiry_id}" if feedback.inquiry_id else None
    title = f"estaro {KIND_LABELS[feedback.kind]} von {feedback.user_name}"
    lines = [title, "", feedback.message]
    if feedback.target:
        lines.append(f"Bezug: {feedback.target}")
    if link:
        lines.append(f"Anfrage: {link}")
    return {
        # "text" is understood by Slack, Teams and many ticket integrations.
        "text": "\n".join(lines),
        "title": title,
        "feedback": feedback.model_dump(mode="json"),
        "link": link,
    }


@retry(
    retry=retry_if_exception_type(httpx.TransportError),
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=0.5, max=2),
    reraise=True,
)
async def _post(url: str, payload: dict[str, object]) -> None:
    async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT_SECONDS) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()


async def forward_feedback(feedback: Feedback, webhook_url: str, app_url: str) -> bool:
    """Send feedback to the webhook; failures are logged, the feedback stays stored."""
    try:
        await _post(webhook_url, webhook_payload(feedback, app_url))
    except httpx.HTTPError:
        logger.exception("feedback_forward_failed", feedback_id=str(feedback.id))
        return False
    logger.info("feedback_forwarded", feedback_id=str(feedback.id))
    return True
