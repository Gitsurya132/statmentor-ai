from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import (
    datasets,
    health,
    methods,
    projects,
    recommendations,
    research_designs,
    variables,
)

api_v1_router = APIRouter()
api_v1_router.include_router(health.router, prefix="/health", tags=["health"])
api_v1_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_v1_router.include_router(datasets.router, tags=["datasets"])
api_v1_router.include_router(variables.router, tags=["variables"])
api_v1_router.include_router(research_designs.router, tags=["research-designs"])
api_v1_router.include_router(methods.router, tags=["methods"])
api_v1_router.include_router(recommendations.router, tags=["recommendations"])
