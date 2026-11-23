"""Measure time and peak memory of PDF conversion per configuration; run from backend
with python -m scripts.benchmark_pdf_conversion PDF_DIR.

Each configuration runs in a fresh process so the peak resident memory (RSS) is
not inflated by earlier runs. PDFs are converted one after another, like the
extraction worker does.
"""

import argparse
import json
import os
import resource
import subprocess
import sys
import time
from pathlib import Path

import structlog
from pydantic import BaseModel
from rich.console import Console
from rich.table import Table

from app.pipelines.extraction.document_classification import _convert_document

logger = structlog.get_logger(__name__)
console = Console()


class Config(BaseModel):
    num_threads: int
    images_scale: float
    ocr_enabled: bool


class Measurement(BaseModel):
    config: Config
    documents: int
    pages: int
    failures: int
    seconds: float
    peak_rss_mb: int


DEFAULT_CONFIGS = [
    Config(num_threads=16, images_scale=2.0, ocr_enabled=True),
    Config(num_threads=4, images_scale=2.0, ocr_enabled=True),
    Config(num_threads=2, images_scale=2.0, ocr_enabled=True),
    Config(num_threads=4, images_scale=1.0, ocr_enabled=True),
    Config(num_threads=4, images_scale=2.0, ocr_enabled=False),
    Config(num_threads=2, images_scale=1.0, ocr_enabled=False),
]


def convert_all(pdf_dir: Path) -> dict[str, int | float]:
    documents = pages = failures = 0
    started = time.perf_counter()
    for path in sorted(pdf_dir.glob("*.pdf")):
        documents += 1
        try:
            pages += len(_convert_document(path.read_bytes()).pages)
        except Exception:
            logger.exception("benchmark_conversion_failed", file=path.name)
            failures += 1
    return {
        "documents": documents,
        "pages": pages,
        "failures": failures,
        "seconds": round(time.perf_counter() - started, 1),
        "peak_rss_mb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024,
    }


def measure(pdf_dir: Path, config: Config) -> Measurement:
    env = os.environ | {
        "PDF_NUM_THREADS": str(config.num_threads),
        "PDF_IMAGES_SCALE": str(config.images_scale),
        "PDF_OCR_ENABLED": str(config.ocr_enabled).lower(),
    }
    completed = subprocess.run(
        [sys.executable, "-m", "scripts.benchmark_pdf_conversion", "--worker"]
        + [str(pdf_dir)],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    result = json.loads(completed.stdout.strip().splitlines()[-1])
    return Measurement(config=config, **result)


def render(measurements: list[Measurement]) -> Table:
    table = Table(title="PDF-Konvertierung")
    for column in ("Threads", "Bildskala", "OCR", "PDFs", "Seiten", "Fehler"):
        table.add_column(column)
    table.add_column("Sekunden", justify="right")
    table.add_column("Peak RAM (MB)", justify="right")
    for item in measurements:
        table.add_row(
            str(item.config.num_threads),
            str(item.config.images_scale),
            "an" if item.config.ocr_enabled else "aus",
            str(item.documents),
            str(item.pages),
            str(item.failures),
            str(item.seconds),
            str(item.peak_rss_mb),
        )
    return table


def to_markdown(measurements: list[Measurement]) -> str:
    lines = [
        "| Threads | Bildskala | OCR | PDFs | Seiten | Fehler | Sekunden | Peak RAM (MB) |",
        "|---:|---:|:---:|---:|---:|---:|---:|---:|",
    ]
    for item in measurements:
        lines.append(
            f"| {item.config.num_threads} | {item.config.images_scale} | "
            f"{'an' if item.config.ocr_enabled else 'aus'} | {item.documents} | "
            f"{item.pages} | {item.failures} | {item.seconds} | {item.peak_rss_mb} |"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf_dir", type=Path)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--markdown", type=Path, help="Write results as Markdown")
    args = parser.parse_args()

    if not args.pdf_dir.is_dir():
        console.print(f"[red]Not a directory: {args.pdf_dir}[/red]")
        return 1
    if args.worker:
        print(json.dumps(convert_all(args.pdf_dir)))
        return 0

    measurements: list[Measurement] = []
    try:
        for config in DEFAULT_CONFIGS:
            with console.status(f"Measuring {config.model_dump()}"):
                measurements.append(measure(args.pdf_dir, config))
            logger.info("benchmark_config_measured", **measurements[-1].model_dump())
    except subprocess.CalledProcessError as error:
        logger.exception("benchmark_worker_failed", stderr=error.stderr[-2000:])
        return 1

    console.print(render(measurements))
    if args.markdown:
        args.markdown.write_text(to_markdown(measurements) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
