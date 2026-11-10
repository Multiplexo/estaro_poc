"""FastAPI application setup and shared exception handling."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import Error as PsycopgError
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.models.api.health import RootResponse
from app.persistence.jobs.matching.memory_repository import matching_memory
from app.routes.articles import router as articles_router
from app.routes.customers import router as customers_router
from app.routes.extractions import router as extractions_router
from app.routes.inquiries import router as inquiries_router
from app.routes.matching import router as matching_router
from app.routes.outlook import router as outlook_router
from app.routes.rules import router as rules_router
from app.services.shared.database import database_service

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Release pooled database connections when the application stops."""
    try:
        async with matching_memory(
            get_settings(), database_service.session_factory
        ) as memory:
            app.state.matching_memory = memory
            yield
    finally:
        try:
            await database_service.engine.dispose()
        except SQLAlchemyError:
            logger.exception("database_dispose_failed")
            raise


app = FastAPI(title="Estaro API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        dict.fromkeys([get_settings().MS_FRONTEND_URL, *get_settings().CORS_ORIGINS])
    ),
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
)


@app.exception_handler(SQLAlchemyError)
@app.exception_handler(PsycopgError)
@app.exception_handler(OSError)
async def database_error(request: Request, exc: Exception) -> JSONResponse:
    """Return an HTTP 503 without exposing database details."""
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


app.include_router(articles_router, prefix="/articles", tags=["articles"])
app.include_router(customers_router, prefix="/customers", tags=["customers"])
app.include_router(inquiries_router, prefix="/inquiries", tags=["inquiries"])
app.include_router(extractions_router, prefix="/extractions", tags=["extractions"])
app.include_router(matching_router, prefix="/extractions", tags=["matching"])
app.include_router(rules_router, prefix="/rules", tags=["rules"])
app.include_router(outlook_router, prefix="/auth", tags=["outlook"])


@app.get("/", response_model=RootResponse, operation_id="get_root")
async def root() -> RootResponse:
    """Return the application's root response."""
    return RootResponse()
