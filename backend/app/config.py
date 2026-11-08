import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit

import structlog
from fastapi import Depends
from pydantic import Field, field_validator
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
    MATCHING_CONCURRENCY: int = Field(default=3, ge=1, le=10)
    MATCHING_TIMEOUT_SECONDS: int = Field(default=600, ge=1, le=3600)
    EXTRACTION_CONFIDENCE_THRESHOLD: float = Field(default=0.5, ge=0, le=1)

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

    CORS_ORIGINS: list[str] = Field(default_factory=list)

    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""
    MS_AUTHORITY: str = "https://login.microsoftonline.com/consumers"
    MS_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    MS_FRONTEND_URL: str = "http://localhost:5173"
    MS_FETCH_ENABLED: bool = False
    MS_FETCH_INTERVAL_SECONDS: int = Field(default=300, ge=1)

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, value: list[str]) -> list[str]:
        return list(
            dict.fromkeys(cls.validate_frontend_url(origin) for origin in value)
        )

    @field_validator("MS_FRONTEND_URL")
    @classmethod
    def validate_frontend_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Frontend URLs must be explicit HTTP or HTTPS origins")
        return value.rstrip("/")

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
