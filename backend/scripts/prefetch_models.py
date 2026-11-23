"""Download the Docling models the extraction pipeline uses; run from backend with
python -m scripts.prefetch_models.

Converts a blank PDF with the application's own converter settings so exactly the
models used at runtime end up in the Hugging Face cache (HF_HOME). Container
images run this at build time and set HF_HUB_OFFLINE=1 at runtime.
"""

import io
import sys

import pypdfium2
import structlog
from rich.console import Console

from app.pipelines.extraction.document_classification import _convert_document

logger = structlog.get_logger(__name__)
console = Console()

A4_WIDTH_PT = 595
A4_HEIGHT_PT = 842


def blank_pdf() -> bytes:
    document = pypdfium2.PdfDocument.new()
    try:
        document.new_page(A4_WIDTH_PT, A4_HEIGHT_PT)
        buffer = io.BytesIO()
        document.save(buffer)
        return buffer.getvalue()
    finally:
        document.close()


def main() -> int:
    try:
        with console.status("Downloading Docling models"):
            _convert_document(blank_pdf())
    except Exception:
        logger.exception("model_prefetch_failed")
        return 1
    console.print("[green]Docling models are cached.[/green]")
    logger.info("model_prefetch_completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
