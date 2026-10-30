import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated

import structlog
from fastapi import Depends
from pydantic_settings import BaseSettings, SettingsConfigDict
from rich.logging import RichHandler


class Settings(BaseSettings):
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "estaro"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_POOL_SIZE: int = 5
    POSTGRES_MAX_OVERFLOW: int = 10

    CELERY_BROKER_URL: str = "redis://localhost:6379/0"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_PUBLIC_ENDPOINT: str | None = None
    MINIO_PUBLIC_SECURE: bool | None = None
    MINIO_REGION: str = "us-east-1"
    MINIO_ACCESS_KEY: str = "estaro-admin"
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET: str = "inquiries"
    MINIO_SECURE: bool = False
    MINIO_API_PORT: int = 9000
    MINIO_CONSOLE_PORT: int = 9001

    OPENAI_API_KEY: str = ""
    MODEL: str = "gtp-6.1-luna"

    model_config = SettingsConfigDict(
        env_file=(
            Path(__file__).resolve().parents[2] / ".env",
            Path(__file__).resolve().parents[1] / ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[RichHandler(rich_tracebacks=True)],
    force=True,
)
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer(colors=False),
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger(__name__)
