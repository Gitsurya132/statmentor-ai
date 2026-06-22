from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_development_user_id, get_project_repository
from app.db.enums import ProjectStatus
from app.db.models.project import Project
from app.main import app
from app.schemas.project import ProjectCreate, ProjectUpdate

DEVELOPMENT_USER_ID = UUID("00000000-0000-4000-8000-000000000001")


def make_project(
    *,
    project_id: UUID | None = None,
    title: str = "Sample Project",
    status: ProjectStatus = ProjectStatus.ACTIVE,
) -> Project:
    now = datetime.now(UTC)
    return Project(
        id=project_id or uuid4(),
        user_id=DEVELOPMENT_USER_ID,
        title=title,
        description="Description",
        research_context={"discipline": "education"},
        status=status,
        created_at=now,
        updated_at=now,
    )


class FakeProjectRepository:
    def __init__(self) -> None:
        self.projects: dict[UUID, Project] = {}

    async def list_for_user(
        self,
        *,
        user_id: UUID,
        page: int,
        page_size: int,
        status: ProjectStatus | None = None,
    ) -> tuple[list[Project], int]:
        projects = [
            project
            for project in self.projects.values()
            if project.user_id == user_id and (status is None or project.status == status)
        ]
        start = (page - 1) * page_size
        return projects[start : start + page_size], len(projects)

    async def get_for_user(self, *, project_id: UUID, user_id: UUID) -> Project | None:
        project = self.projects.get(project_id)
        if project is None or project.user_id != user_id:
            return None
        return project

    async def create(self, *, user_id: UUID, data: ProjectCreate) -> Project:
        project = make_project(title=data.title)
        project.user_id = user_id
        project.description = data.description
        project.research_context = data.research_context
        self.projects[project.id] = project
        return project

    async def update(self, *, project: Project, data: ProjectUpdate) -> Project:
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(project, field, value)
        return project

    async def delete(self, *, project: Project) -> None:
        del self.projects[project.id]


@pytest.fixture
def repository() -> FakeProjectRepository:
    return FakeProjectRepository()


@pytest.fixture
def client(repository: FakeProjectRepository) -> Generator[TestClient]:
    app.dependency_overrides[get_project_repository] = lambda: repository
    app.dependency_overrides[get_development_user_id] = lambda: DEVELOPMENT_USER_ID
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_list_projects(client: TestClient, repository: FakeProjectRepository) -> None:
    project = make_project()
    repository.projects[project.id] = project

    response = client.get("/api/v1/projects")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == str(project.id)


def test_create_project(client: TestClient) -> None:
    response = client.post(
        "/api/v1/projects",
        json={
            "title": "Created Project",
            "description": "Created through API",
            "research_context": {"discipline": "psychology"},
        },
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Created Project"
    assert response.json()["user_id"] == str(DEVELOPMENT_USER_ID)


def test_get_project(client: TestClient, repository: FakeProjectRepository) -> None:
    project = make_project()
    repository.projects[project.id] = project

    response = client.get(f"/api/v1/projects/{project.id}")

    assert response.status_code == 200
    assert response.json()["id"] == str(project.id)


def test_get_project_returns_404(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{uuid4()}")

    assert response.status_code == 404


def test_update_project(client: TestClient, repository: FakeProjectRepository) -> None:
    project = make_project()
    repository.projects[project.id] = project

    response = client.patch(
        f"/api/v1/projects/{project.id}",
        json={"title": "Updated Project", "status": "archived"},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated Project"
    assert response.json()["status"] == "archived"


def test_delete_project(client: TestClient, repository: FakeProjectRepository) -> None:
    project = make_project()
    repository.projects[project.id] = project

    response = client.delete(f"/api/v1/projects/{project.id}")

    assert response.status_code == 204
    assert project.id not in repository.projects
