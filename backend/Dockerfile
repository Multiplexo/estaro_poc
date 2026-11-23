FROM ghcr.io/astral-sh/uv:0.13.6 AS uv
FROM python:3.13-slim

COPY --from=uv /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 PYTHONUNBUFFERED=1 HF_HOME=/opt/hf-cache
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts
# Bake the Docling models into the image; nothing is downloaded at runtime.
RUN .venv/bin/python -m scripts.prefetch_models && chmod -R a+rX /opt/hf-cache
ENV HF_HUB_OFFLINE=1
RUN useradd --create-home worker
USER worker

CMD ["/app/.venv/bin/celery", "-A", "app.workers.celery_app:celery_app", "worker", "--loglevel=info", "--queues=extraction", "--concurrency=2"]
