from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db_session
from app.ingestion.storage import LocalDatasetStorage
from app.repositories.dataset import DatasetRepository
from app.repositories.project import ProjectRepository
from app.repositories.research_design import ResearchDesignRepository
from app.services.dataset import DatasetService
from app.services.recommendation import RecommendationService
from app.services.research_design import ResearchDesignService

DatabaseSession = Annotated[AsyncSession, Depends(get_db_session)]


def get_project_repository(session: DatabaseSession) -> ProjectRepository:
    return ProjectRepository(session)


def get_dataset_repository(session: DatabaseSession) -> DatasetRepository:
    return DatasetRepository(session)


def get_research_design_repository(session: DatabaseSession) -> ResearchDesignRepository:
    return ResearchDesignRepository(session)


def get_dataset_storage() -> LocalDatasetStorage:
    settings = get_settings()
    return LocalDatasetStorage(
        root=settings.upload_root,
        max_upload_size_bytes=settings.max_upload_size_bytes,
    )


DatasetRepositoryDependency = Annotated[
    DatasetRepository,
    Depends(get_dataset_repository),
]


def get_dataset_service(
    repository: DatasetRepositoryDependency,
    storage: Annotated[LocalDatasetStorage, Depends(get_dataset_storage)],
) -> DatasetService:
    return DatasetService(repository=repository, storage=storage)


DatasetServiceDependency = Annotated[DatasetService, Depends(get_dataset_service)]


def get_recommendation_service(
    dataset_repository: DatasetRepositoryDependency,
    research_design_repository: ResearchDesignRepositoryDependency,
) -> RecommendationService:
    return RecommendationService(
        dataset_repository=dataset_repository,
        research_design_repository=research_design_repository,
    )


RecommendationServiceDependency = Annotated[
    RecommendationService,
    Depends(get_recommendation_service),
]


ResearchDesignRepositoryDependency = Annotated[
    ResearchDesignRepository,
    Depends(get_research_design_repository),
]


def get_research_design_service(
    repository: ResearchDesignRepositoryDependency,
) -> ResearchDesignService:
    return ResearchDesignService(repository)


ResearchDesignServiceDependency = Annotated[
    ResearchDesignService,
    Depends(get_research_design_service),
]


ProjectRepositoryDependency = Annotated[
    ProjectRepository,
    Depends(get_project_repository),
]


def get_development_user_id() -> UUID:
    return get_settings().development_user_id


DevelopmentUserId = Annotated[UUID, Depends(get_development_user_id)]
