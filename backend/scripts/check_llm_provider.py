"""Check that the configured AI provider supports everything the pipelines use; run
from backend with python -m scripts.check_llm_provider.

Uses API_KEY, MODEL and LLM_BASE_URL from the environment or .env, and the same
client setup as the application (OpenAI Responses API via LangChain). Sends only
synthetic test data, no customer data.
"""

import asyncio
import base64
import io
import sys
import time
from collections.abc import Awaitable, Callable

import structlog
from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field
from rich.console import Console
from rich.table import Table

from app.config import get_settings
from app.services.shared.ai import AIService, describe_ai_error

logger = structlog.get_logger(__name__)
console = Console()

IMAGE_NUMBER = "4571"


class CheckResult(BaseModel):
    name: str
    passed: bool
    seconds: float
    detail: str


class MaterialAnswer(BaseModel):
    material_number: str = Field(description="Werkstoffnummer im Format 1.xxxx")


@tool
def search_article(matchcode: str) -> str:
    """Suche einen Artikel im Artikelstamm über seinen Matchcode."""
    return f"Artikel zu {matchcode}"


def number_image() -> str:
    image = Image.new("RGB", (480, 160), "white")
    ImageDraw.Draw(image).text(
        (40, 30), IMAGE_NUMBER, fill="black", font=ImageFont.load_default(size=96)
    )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


async def check_text(ai: AIService, model: str) -> str:
    response = await ai.client.responses.create(
        model=model, input="Antworte nur mit dem Wort OK."
    )
    text = response.output_text.strip()
    if "OK" not in text.upper():
        raise AssertionError(f"Unerwartete Antwort: {text[:80]}")
    return text[:80]


async def check_image(ai: AIService, model: str) -> str:
    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": "Welche Zahl steht im Bild? Antworte nur mit der Zahl.",
            },
            {
                "type": "image_url",
                "image_url": {"url": number_image(), "detail": "high"},
            },
        ]
    )
    response = await ai.get_chat_model().ainvoke([message])
    if IMAGE_NUMBER not in response.text:
        raise AssertionError(f"Zahl nicht erkannt: {response.text[:80]}")
    return response.text[:80]


async def check_structured_output(ai: AIService, model: str) -> str:
    structured = ai.get_chat_model().with_structured_output(
        MaterialAnswer, method="json_schema", strict=True
    )
    answer = await structured.ainvoke(
        "Welche Werkstoffnummer hat der Edelstahl AISI 316Ti? Nur die Nummer."
    )
    if not isinstance(answer, MaterialAnswer) or "4571" not in answer.material_number:
        raise AssertionError(f"Unerwartete Ausgabe: {answer!r}"[:120])
    return answer.material_number


async def check_tool_call(ai: AIService, model: str) -> str:
    response = await (
        ai.get_chat_model()
        .bind_tools([search_article])
        .ainvoke(
            "Suche den Artikel mit dem Matchcode 'nr 14x1,5 4571' im Artikelstamm."
        )
    )
    names = [call["name"] for call in response.tool_calls]
    if "search_article" not in names:
        raise AssertionError(f"Kein Werkzeugaufruf, Antwort: {response.text[:80]}")
    return f"Aufruf: {names}"


CHECKS: list[tuple[str, Callable[[AIService, str], Awaitable[str]]]] = [
    ("Responses API (Text)", check_text),
    ("Bildeingabe", check_image),
    ("Strukturierte Ausgabe", check_structured_output),
    ("Werkzeugaufruf", check_tool_call),
]


async def run_checks() -> list[CheckResult]:
    settings = get_settings()
    results: list[CheckResult] = []
    async with AIService(settings) as ai:
        for name, check in CHECKS:
            started = time.perf_counter()
            try:
                detail = await check(ai, settings.MODEL)
                passed = True
            except Exception as error:
                logger.exception("llm_provider_check_failed", check=name)
                detail = describe_ai_error(error, settings.MODEL) or str(error)[:200]
                passed = False
            results.append(
                CheckResult(
                    name=name,
                    passed=passed,
                    seconds=round(time.perf_counter() - started, 1),
                    detail=detail,
                )
            )
    return results


def main() -> int:
    settings = get_settings()
    if not settings.API_KEY:
        console.print("[red]API_KEY ist nicht gesetzt.[/red]")
        return 1
    console.print(
        f"Anbieter: [bold]{settings.LLM_BASE_URL or 'Standard (OPENAI_BASE_URL/OpenAI)'}"
        f"[/bold] · Modell: [bold]{settings.MODEL}[/bold]"
    )
    results = asyncio.run(run_checks())

    table = Table(title="Prüfung KI-Anbieter")
    for column in ("Prüfung", "Ergebnis", "Sekunden", "Details"):
        table.add_column(column)
    for result in results:
        table.add_row(
            result.name,
            "[green]ok[/green]" if result.passed else "[red]fehlgeschlagen[/red]",
            str(result.seconds),
            result.detail,
        )
    console.print(table)
    passed = all(result.passed for result in results)
    logger.info(
        "llm_provider_check_completed",
        passed=passed,
        model=settings.MODEL,
        failed=[result.name for result in results if not result.passed],
    )
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
