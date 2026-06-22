from __future__ import annotations

from collections.abc import Generator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_development_user_id, get_recommendation_service
from app.db.enums import AnalysisMethod
from app.main import app
from app.schemas.recommendation import (
    TestRecommendation as RecommendationSchema,
)
from app.schemas.recommendation import (
    TestRecommendationRequest as RecommendationRequestSchema,
)
from app.schemas.recommendation import (
    TestRecommendationResponse as RecommendationResponseSchema,
)

USER_ID = UUID("00000000-0000-4000-8000-000000000001")
PROJECT_ID = UUID("00000000-0000-4000-8000-000000000002")


class FakeRecommendationService:
    async def recommend(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        request: RecommendationRequestSchema,
    ) -> RecommendationResponseSchema:
        return RecommendationResponseSchema(
            project_id=project_id,
            research_design_id=request.research_design_id,
            dataset_version_id=request.dataset_version_id,
            recommendations=[
                RecommendationSchema(
                    method_key=AnalysisMethod.PEARSON_CORRELATION,
                    method_name="Pearson Correlation",
                    why_recommended="Two continuous variables are selected.",
                    required_variables=["At least two interval or ratio variables."],
                    assumptions=["Linear relationship"],
                    sample_size_guidance="Use an a priori power analysis.",
                    advantages=["Interpretable standardized association."],
                    limitations=["Sensitive to outliers."],
                    alternatives=[AnalysisMethod.SPEARMAN_CORRELATION],
                    confidence_score=0.88,
                )
            ],
            advisory_note="Guidance only.",
        )


@pytest.fixture
def client() -> Generator[TestClient]:
    app.dependency_overrides[get_recommendation_service] = (
        lambda: FakeRecommendationService()
    )
    app.dependency_overrides[get_development_user_id] = lambda: USER_ID
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_recommendation_endpoint(client: TestClient) -> None:
    response = client.post(
        f"/api/v1/projects/{PROJECT_ID}/test-recommendations",
        json={
            "research_design_id": str(uuid4()),
            "dataset_version_id": str(uuid4()),
            "variables": [
                {
                    "variable_id": str(uuid4()),
                    "role": "independent_variable",
                    "scale_type": "ratio",
                },
                {
                    "variable_id": str(uuid4()),
                    "role": "dependent_variable",
                    "scale_type": "interval",
                },
            ],
        },
    )

    assert response.status_code == 200
    recommendation = response.json()["recommendations"][0]
    assert recommendation["method_key"] == "pearson_correlation"
    assert recommendation["confidence_score"] == 0.88
