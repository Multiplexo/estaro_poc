# All-in-one demo image for Render: web UI, API, Celery worker + beat,
# Redis and MinIO in one container. Build context is the repository root.

FROM oven/bun:1.4.3 AS frontend
WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

FROM cgr.dev/chainguard/minio:latest-dev@sha256:3117ce7ad401284dbf57a1a5e1b8abe3984630bb51e4341d69754599977f3dae AS minio

FROM ghcr.io/astral-sh/uv:0.13.6 AS uv

FROM python:3.13-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx redis-server \
    && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default
COPY --from=uv /uv /uvx /bin/
COPY --from=minio /usr/bin/minio /usr/local/bin/minio

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 PYTHONUNBUFFERED=1 PORT=10000
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev
COPY backend/app ./app
COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/scripts ./scripts

COPY --from=frontend /app/dist /app/frontend
COPY deploy/render/nginx.conf /etc/nginx/conf.d/estaro.conf
COPY deploy/render/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 10000
CMD ["/app/start.sh"]
