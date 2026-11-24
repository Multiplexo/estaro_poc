import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal, Self
from urllib.parse import urlsplit

import structlog
from fastapi import Depends
from pydantic import Field, field_validator, model_validator
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

    # "console" for readable local output, "json" for log platforms in production.
    LOG_FORMAT: Literal["console", "json"] = "console"

    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    MATCHING_CONCURRENCY: int = Field(default=3, ge=1, le=10)
    MATCHING_TIMEOUT_SECONDS: int = Field(default=600, ge=1, le=3600)
    EXTRACTION_CONFIDENCE_THRESHOLD: float = Field(default=0.5, ge=0, le=1)

    # PDF conversion (Docling). Not prefixed DOCLING_ because Docling reads that
    # prefix for its own settings.
    PDF_NUM_THREADS: int = Field(default=4, ge=1, le=64)
    PDF_IMAGES_SCALE: float = Field(default=2.0, gt=0, le=4)
    PDF_OCR_ENABLED: bool = True

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

    # OpenAI-compatible endpoint, e.g. https://api.langdock.com/openai/eu/v1.
    # Empty uses OPENAI_BASE_URL or the OpenAI default.
    LLM_BASE_URL: str | None = None
    API_KEY: str = ""
    # Retries for rate limits (429, honoring Retry-After), timeouts and 5xx.
    LLM_MAX_RETRIES: int = Field(default=4, ge=0, le=10)
    # Prices in EUR per 1M tokens for the cost overview; empty shows tokens only.
    LLM_PRICE_INPUT_EUR_PER_MILLION: float | None = Field(default=None, ge=0)
    LLM_PRICE_OUTPUT_EUR_PER_MILLION: float | None = Field(default=None, ge=0)
    MODEL: str = "gtp-6.1-luna"
    RECURSION_LIMIT: int = Field(default=50, ge=1)

    CORS_ORIGINS: list[str] = Field(default_factory=list)

    MS_CLIENT_ID: str = ""
    MS_CLIENT_SECRET: str = ""
    MS_AUTHORITY: str = "https://login.microsoftonline.com/consumers"
    MS_REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    MS_FRONTEND_URL: str = "http://localhost:5173"
    MS_FETCH_ENABLED: bool = False
    # Shared mailbox read with application permission (Mail.Read). Empty uses the
    # mailbox of the user who connected Outlook in the settings page.
    MS_MAILBOX: str = ""
    MS_FETCH_INTERVAL_SECONDS: int = Field(default=300, ge=1)

    # Nightly master data sync. "csv" reads Artikelstamm.csv/Kundenstamm.csv from
    # MASTERDATA_CSV_DIR; "sql" runs the two queries, whose column aliases must
    # match the CSV export headers. Empty disables the scheduled sync.
    MASTERDATA_SOURCE: Literal["", "csv", "sql"] = ""
    MASTERDATA_CSV_DIR: str = "/data/stammdaten"
    MASTERDATA_SQL_URL: str = ""
    MASTERDATA_ARTICLES_QUERY: str = "SELECT * FROM estaro_artikel"
    MASTERDATA_CUSTOMERS_QUERY: str = "SELECT * FROM estaro_kunden"
    MASTERDATA_SYNC_HOUR_UTC: int = Field(default=2, ge=0, le=23)
    MASTERDATA_DEACTIVATE_MISSING: bool = True

    # JSON mapping for the Sage import file; empty uses app/exports/sage_default.json.
    SAGE_EXPORT_MAPPING: str = ""

    # Feedback is stored and, if set, posted as JSON to this webhook (ticket system).
    FEEDBACK_WEBHOOK_URL: str = ""

    # Sign-in with Microsoft Entra ID. Disabled locally; every request then runs as
    # a local admin user.
    AUTH_ENABLED: bool = False
    AUTH_TENANT_ID: str = ""
    AUTH_CLIENT_ID: str = ""
    AUTH_CLIENT_SECRET: str = ""
    AUTH_AUTHORITY_HOST: str = "https://login.microsoftonline.com"
    AUTH_REDIRECT_URI: str = "http://localhost:5173/api/session/callback"
    AUTH_ADMIN_ROLE: str = "admin"
    AUTH_USER_ROLE: str = "bearbeiter"
    SESSION_SECRET: str = ""
    SESSION_MAX_AGE_SECONDS: int = Field(default=8 * 3600, ge=300, le=7 * 24 * 3600)

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

    @model_validator(mode="after")
    def validate_auth(self) -> Self:
        if not self.AUTH_ENABLED:
            return self
        missing = [
            name
            for name in ("AUTH_TENANT_ID", "AUTH_CLIENT_ID", "AUTH_CLIENT_SECRET")
            if not getattr(self, name)
        ]
        if missing:
            raise ValueError(f"AUTH_ENABLED requires {', '.join(missing)}")
        if len(self.SESSION_SECRET) < 32:
            raise ValueError("AUTH_ENABLED requires SESSION_SECRET of 32+ characters")
        return self

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


def configure_logging(log_format: str) -> None:
    if log_format == "json":
        timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)
        handler = logging.StreamHandler()
        handler.setFormatter(
            structlog.stdlib.ProcessorFormatter(
                processors=[
                    structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                    structlog.processors.format_exc_info,
                    structlog.processors.JSONRenderer(ensure_ascii=False),
                ],
                foreign_pre_chain=[
                    structlog.stdlib.add_log_level,
                    structlog.stdlib.add_logger_name,
                    timestamper,
                ],
            )
        )
        logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
        structlog.configure(
            processors=[
                structlog.stdlib.add_log_level,
                structlog.stdlib.add_logger_name,
                timestamper,
                structlog.processors.StackInfoRenderer(),
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
            ],
            logger_factory=structlog.stdlib.LoggerFactory(),
        )
        return
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


configure_logging(get_settings().LOG_FORMAT)

logger = structlog.get_logger(__name__)
