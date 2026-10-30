"""FastAPI application setup and shared exception handling."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.models.api.health import RootResponse
from app.routes.articles import router as articles_router
from app.routes.customers import router as customers_router
from app.routes.extractions import router as extractions_router
from app.routes.inquiries import router as inquiries_router
from app.services.shared.database import database_service

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Release pooled database connections when the application stops."""
    try:
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
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SQLAlchemyError)
@app.exception_handler(OSError)
async def database_error(request: Request, exc: Exception) -> JSONResponse:
    """Return an HTTP 503 without exposing database details."""
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


app.include_router(articles_router, prefix="/articles", tags=["articles"])
app.include_router(customers_router, prefix="/customers", tags=["customers"])
app.include_router(inquiries_router, prefix="/inquiries", tags=["inquiries"])
app.include_router(extractions_router, prefix="/extractions", tags=["extractions"])


@app.get("/", response_model=RootResponse, operation_id="get_root")
async def root() -> RootResponse:
    """Return the application's root response."""
    return RootResponse()
