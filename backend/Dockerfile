FROM ghcr.io/astral-sh/uv:0.13.6 AS uv
FROM python:3.13-slim

COPY --from=uv /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
RUN useradd --create-home worker
USER worker

CMD ["/app/.venv/bin/celery", "-A", "app.workers.celery_app:celery_app", "worker", "--loglevel=info", "--queues=extraction", "--concurrency=2"]
