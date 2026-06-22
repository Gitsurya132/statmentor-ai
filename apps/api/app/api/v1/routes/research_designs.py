from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import (
    DevelopmentUserId,
    ResearchDesignRepositoryDependency,
    ResearchDesignServiceDependency,
)
from app.schemas.research_question import (
    ResearchDesignCreate,
    ResearchDesignRead,
    ResearchDesignSummary,
    ResearchDesignUpdate,
)
from app.services.research_design import (
    research_design_response,
)

router = APIRouter()


@router.post(
    "/projects/{project_id}/research-designs",
    response_model=ResearchDesignRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_research_design(
    project_id: UUID,
    data: ResearchDesignCreate,
    service: ResearchDesignServiceDependency,
    development_user_id: DevelopmentUserId,
) -> ResearchDesignRead:
    try:
        design = await service.create(
            project_id=project_id,
            user_id=development_user_id,
            data=data,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Research design could not be created.",
        ) from exc
    return research_design_response(design)


@router.get("/research-designs/{design_id}", response_model=ResearchDesignRead)
async def get_research_design(
    design_id: UUID,
    repository: ResearchDesignRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> ResearchDesignRead:
    design = await repository.get_for_user(
        design_id=design_id,
        user_id=development_user_id,
    )
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research design not found",
        )
    return research_design_response(design)


@router.patch("/research-designs/{design_id}", response_model=ResearchDesignRead)
async def update_research_design(
    design_id: UUID,
    data: ResearchDesignUpdate,
    repository: ResearchDesignRepositoryDependency,
    service: ResearchDesignServiceDependency,
    development_user_id: DevelopmentUserId,
) -> ResearchDesignRead:
    design = await repository.get_for_user(
        design_id=design_id,
        user_id=development_user_id,
    )
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research design not found",
        )
    try:
        design = await service.update(design=design, data=data)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Research design could not be updated.",
        ) from exc
    return research_design_response(design)


@router.get(
    "/research-designs/{design_id}/summary",
    response_model=ResearchDesignSummary,
)
async def get_research_design_summary(
    design_id: UUID,
    repository: ResearchDesignRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> ResearchDesignSummary:
    design = await repository.get_for_user(
        design_id=design_id,
        user_id=development_user_id,
    )
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research design not found",
        )
    response = research_design_response(design)
    return ResearchDesignSummary(design_id=design.id, summary=response.summary)
