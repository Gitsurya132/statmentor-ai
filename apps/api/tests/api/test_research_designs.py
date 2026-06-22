from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import (
    get_development_user_id,
    get_research_design_repository,
    get_research_design_service,
)
from app.db.models.research_question import ResearchQuestion
from app.main import app
from app.services.research_design import ResearchDesignService

DEVELOPMENT_USER_ID = UUID("00000000-0000-4000-8000-000000000001")
PROJECT_ID = UUID("00000000-0000-4000-8000-000000000002")


class FakeResearchDesignRepository:
    def __init__(self) -> None:
        self.designs: dict[UUID, ResearchQuestion] = {}

    async def project_exists_for_user(self, *, project_id: UUID, user_id: UUID) -> bool:
        return project_id == PROJECT_ID and user_id == DEVELOPMENT_USER_ID

    async def get_for_user(
        self, *, design_id: UUID, user_id: UUID
    ) -> ResearchQuestion | None:
        return self.designs.get(design_id) if user_id == DEVELOPMENT_USER_ID else None

    async def create(self, design: ResearchQuestion) -> ResearchQuestion:
        now = datetime.now(UTC)
        design.id = uuid4()
        design.created_at = now
        design.updated_at = now
        self.designs[design.id] = design
        return design

    async def save(self, design: ResearchQuestion) -> ResearchQuestion:
        design.updated_at = datetime.now(UTC)
        self.designs[design.id] = design
        return design


@pytest.fixture
def repository() -> FakeResearchDesignRepository:
    return FakeResearchDesignRepository()


@pytest.fixture
def client(repository: FakeResearchDesignRepository) -> Generator[TestClient]:
    service = ResearchDesignService(repository)  # type: ignore[arg-type]
    app.dependency_overrides[get_research_design_repository] = lambda: repository
    app.dependency_overrides[get_research_design_service] = lambda: service
    app.dependency_overrides[get_development_user_id] = lambda: DEVELOPMENT_USER_ID
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def design_payload() -> dict[str, object]:
    return {
        "study_type": "quantitative",
        "research_questions": ["How are leadership and performance related?"],
        "hypotheses": ["Leadership is positively related to performance."],
        "sample_size": 250,
        "temporal_design": "cross_sectional",
        "study_focus": "relationship",
        "software_preference": "Python",
        "key_constructs": [
            "transformational leadership",
            "organizational culture",
            "employee engagement",
            "organizational performance",
        ],
    }


def test_create_research_design(
    client: TestClient, repository: FakeResearchDesignRepository
) -> None:
    response = client.post(
        f"/api/v1/projects/{PROJECT_ID}/research-designs",
        json=design_payload(),
    )

    assert response.status_code == 201
    assert response.json()["sample_size"] == 250
    assert response.json()["summary"].startswith(
        "You are conducting a cross-sectional quantitative study"
    )
    assert len(repository.designs) == 1


def test_update_and_summarize_research_design(
    client: TestClient, repository: FakeResearchDesignRepository
) -> None:
    create_response = client.post(
        f"/api/v1/projects/{PROJECT_ID}/research-designs",
        json=design_payload(),
    )
    design_id = create_response.json()["id"]

    update_response = client.patch(
        f"/api/v1/research-designs/{design_id}",
        json={"sample_size": 300, "software_preference": "R"},
    )
    summary_response = client.get(f"/api/v1/research-designs/{design_id}/summary")

    assert update_response.status_code == 200
    assert update_response.json()["sample_size"] == 300
    assert update_response.json()["software_preference"] == "R"
    assert summary_response.status_code == 200
    assert "relationship between" in summary_response.json()["summary"]
