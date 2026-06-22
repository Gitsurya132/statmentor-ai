from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.dependencies import DatabaseSession
from app.core.config import get_settings
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter()


@router.get("/live", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Database unavailable"}},
)
async def readiness(session: DatabaseSession) -> ReadinessResponse:
    try:
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from exc
    return ReadinessResponse(status="ready", database="ok")
