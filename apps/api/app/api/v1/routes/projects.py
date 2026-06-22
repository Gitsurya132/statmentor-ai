from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import DevelopmentUserId, ProjectRepositoryDependency
from app.db.enums import ProjectStatus
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter()


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    repository: ProjectRepositoryDependency,
    development_user_id: DevelopmentUserId,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    project_status: Annotated[
        ProjectStatus | None,
        Query(alias="status"),
    ] = None,
) -> ProjectListResponse:
    projects, total = await repository.list_for_user(
        user_id=development_user_id,
        page=page,
        page_size=page_size,
        status=project_status,
    )
    return ProjectListResponse(
        items=[ProjectRead.model_validate(project) for project in projects],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    repository: ProjectRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> ProjectRead:
    try:
        project = await repository.create(user_id=development_user_id, data=data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The development user is not seeded or the project violates a constraint.",
        ) from exc
    return ProjectRead.model_validate(project)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    repository: ProjectRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> ProjectRead:
    project = await repository.get_for_user(
        project_id=project_id,
        user_id=development_user_id,
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return ProjectRead.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    repository: ProjectRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> ProjectRead:
    project = await repository.get_for_user(
        project_id=project_id,
        user_id=development_user_id,
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    try:
        project = await repository.update(project=project, data=data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The project update violates a constraint.",
        ) from exc
    return ProjectRead.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    repository: ProjectRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> Response:
    project = await repository.get_for_user(
        project_id=project_id,
        user_id=development_user_id,
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    try:
        await repository.delete(project=project)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The project could not be deleted.",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
