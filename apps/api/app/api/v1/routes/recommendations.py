from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import DevelopmentUserId, RecommendationServiceDependency
from app.schemas.recommendation import (
    TestRecommendationRequest,
    TestRecommendationResponse,
)
from app.services.recommendation import RecommendationValidationError

router = APIRouter()


@router.post(
    "/projects/{project_id}/test-recommendations",
    response_model=TestRecommendationResponse,
)
async def recommend_tests(
    project_id: UUID,
    data: TestRecommendationRequest,
    service: RecommendationServiceDependency,
    development_user_id: DevelopmentUserId,
) -> TestRecommendationResponse:
    try:
        return await service.recommend(
            project_id=project_id,
            user_id=development_user_id,
            request=data,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RecommendationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

