from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest

from app.db.enums import ProjectStatus
from app.db.models.project import Project
from app.repositories.project import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectUpdate


def make_project(*, user_id: UUID | None = None) -> Project:
    now = datetime.now(UTC)
    return Project(
        id=uuid4(),
        user_id=user_id or uuid4(),
        title="Sample Project",
        description="Description",
        research_context={},
        status=ProjectStatus.ACTIVE,
        created_at=now,
        updated_at=now,
    )


class ScalarCollection:
    def __init__(self, values: list[Project]) -> None:
        self.values = values

    def all(self) -> list[Project]:
        return self.values


@pytest.mark.asyncio
async def test_list_for_user_returns_projects_and_total() -> None:
    session = AsyncMock()
    user_id = uuid4()
    project = make_project(user_id=user_id)
    session.scalar.return_value = 1
    session.scalars.return_value = ScalarCollection([project])
    repository = ProjectRepository(session)

    projects, total = await repository.list_for_user(
        user_id=user_id,
        page=1,
        page_size=20,
    )

    assert projects == [project]
    assert total == 1
    session.scalar.assert_awaited_once()
    session.scalars.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_for_user_returns_owned_project() -> None:
    session = AsyncMock()
    project = make_project()
    session.scalar.return_value = project
    repository = ProjectRepository(session)

    result = await repository.get_for_user(
        project_id=project.id,
        user_id=project.user_id,
    )

    assert result is project
    session.scalar.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_assigns_development_user_and_commits() -> None:
    session = AsyncMock()
    session.add = MagicMock()
    user_id = uuid4()
    repository = ProjectRepository(session)

    project = await repository.create(
        user_id=user_id,
        data=ProjectCreate(
            title="New Project",
            description="Description",
            research_context={"discipline": "education"},
        ),
    )

    assert project.user_id == user_id
    assert project.title == "New Project"
    session.add.assert_called_once_with(project)
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(project)


@pytest.mark.asyncio
async def test_update_applies_only_supplied_fields() -> None:
    session = AsyncMock()
    project = make_project()
    repository = ProjectRepository(session)

    result = await repository.update(
        project=project,
        data=ProjectUpdate(title="Updated Project", status=ProjectStatus.ARCHIVED),
    )

    assert result is project
    assert project.title == "Updated Project"
    assert project.status is ProjectStatus.ARCHIVED
    assert project.description == "Description"
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(project)


@pytest.mark.asyncio
async def test_delete_removes_project_and_commits() -> None:
    session = AsyncMock()
    project = make_project()
    repository = ProjectRepository(session)

    await repository.delete(project=project)

    session.delete.assert_awaited_once_with(project)
    session.commit.assert_awaited_once()
