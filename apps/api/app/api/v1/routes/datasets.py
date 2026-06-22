from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import (
    DatasetRepositoryDependency,
    DatasetServiceDependency,
    DevelopmentUserId,
)
from app.core.config import get_settings
from app.ingestion.exceptions import (
    DatasetTooLargeError,
    InvalidDatasetFileError,
    UnsupportedDatasetFormatError,
)
from app.schemas.dataset import (
    DatasetDetail,
    DatasetListResponse,
    DatasetPreview,
    DatasetRead,
    DatasetVersionRead,
    VariableRead,
)

router = APIRouter()


@router.post(
    "/projects/{project_id}/datasets",
    response_model=DatasetDetail,
    status_code=status.HTTP_201_CREATED,
)
async def upload_dataset(
    project_id: UUID,
    service: DatasetServiceDependency,
    development_user_id: DevelopmentUserId,
    file: Annotated[UploadFile, File(description="CSV or Excel file")],
    name: Annotated[str, Form(min_length=1, max_length=250)],
    description: Annotated[str | None, Form()] = None,
    import_options: Annotated[str, Form()] = "{}",
) -> DatasetDetail:
    if not name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Dataset name must not be blank.",
        )
    try:
        result = await service.upload(
            project_id=project_id,
            user_id=development_user_id,
            upload=file,
            name=name,
            description=description,
            import_options_json=import_options,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedDatasetFormatError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except DatasetTooLargeError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except InvalidDatasetFileError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A dataset with this name already exists in the project.",
        ) from exc

    return DatasetDetail(
        **DatasetRead.model_validate(result.dataset).model_dump(),
        latest_version=DatasetVersionRead.model_validate(result.version),
    )


@router.get("/projects/{project_id}/datasets", response_model=DatasetListResponse)
async def list_datasets(
    project_id: UUID,
    repository: DatasetRepositoryDependency,
    development_user_id: DevelopmentUserId,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> DatasetListResponse:
    if not await repository.project_exists_for_user(
        project_id=project_id,
        user_id=development_user_id,
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    datasets, total = await repository.list_for_project(
        project_id=project_id,
        user_id=development_user_id,
        page=page,
        page_size=page_size,
    )
    return DatasetListResponse(
        items=[DatasetRead.model_validate(dataset) for dataset in datasets],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/datasets/{dataset_id}", response_model=DatasetDetail)
async def get_dataset(
    dataset_id: UUID,
    repository: DatasetRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> DatasetDetail:
    dataset = await repository.get_for_user(
        dataset_id=dataset_id,
        user_id=development_user_id,
    )
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    version = await repository.get_latest_version(dataset.id)
    return DatasetDetail(
        **DatasetRead.model_validate(dataset).model_dump(),
        latest_version=DatasetVersionRead.model_validate(version) if version else None,
    )


@router.get("/dataset-versions/{version_id}", response_model=DatasetVersionRead)
async def get_dataset_version(
    version_id: UUID,
    repository: DatasetRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> DatasetVersionRead:
    version = await repository.get_version_for_user(
        version_id=version_id,
        user_id=development_user_id,
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset version not found",
        )
    return DatasetVersionRead.model_validate(version)


@router.get(
    "/dataset-versions/{version_id}/variables",
    response_model=list[VariableRead],
)
async def list_dataset_variables(
    version_id: UUID,
    repository: DatasetRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> list[VariableRead]:
    variables = await repository.list_variables_for_version(
        version_id=version_id,
        user_id=development_user_id,
    )
    if variables is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset version not found",
        )
    return [VariableRead.model_validate(variable) for variable in variables]


@router.get("/dataset-versions/{version_id}/preview", response_model=DatasetPreview)
async def preview_dataset_version(
    version_id: UUID,
    repository: DatasetRepositoryDependency,
    service: DatasetServiceDependency,
    development_user_id: DevelopmentUserId,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=1000)] = 20,
) -> DatasetPreview:
    settings = get_settings()
    if limit > settings.dataset_preview_max_rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Preview limit cannot exceed {settings.dataset_preview_max_rows}.",
        )
    version = await repository.get_version_for_user(
        version_id=version_id,
        user_id=development_user_id,
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset version not found",
        )
    try:
        columns, rows = await service.preview(version=version, offset=offset, limit=limit)
    except InvalidDatasetFileError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    return DatasetPreview(
        version_id=version.id,
        offset=offset,
        limit=limit,
        total_rows=version.row_count or 0,
        columns=columns,
        rows=rows,
    )
