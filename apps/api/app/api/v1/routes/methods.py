from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.enums import AnalysisMethod
from app.recommendations.registry import get_method, list_methods
from app.schemas.recommendation import MethodMetadata

router = APIRouter()


@router.get("/methods", response_model=list[MethodMetadata])
async def get_methods() -> list[MethodMetadata]:
    return [
        MethodMetadata.model_validate(method, from_attributes=True)
        for method in list_methods()
    ]


@router.get("/methods/{method_key}", response_model=MethodMetadata)
async def get_method_detail(method_key: str) -> MethodMetadata:
    try:
        key = AnalysisMethod(method_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Method not found",
        ) from exc
    return MethodMetadata.model_validate(get_method(key), from_attributes=True)
