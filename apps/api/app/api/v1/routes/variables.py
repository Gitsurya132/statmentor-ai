from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import DatasetRepositoryDependency, DevelopmentUserId
from app.schemas.variable import (
    VariableClassificationBatch,
    VariableMetadataRead,
    VariableMetadataUpdate,
)
from app.services.variable import (
    apply_detected_metadata,
    apply_manual_metadata,
    variable_metadata_response,
)

router = APIRouter()


@router.get("/variables/{variable_id}/metadata", response_model=VariableMetadataRead)
async def get_variable_metadata(
    variable_id: UUID,
    repository: DatasetRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> VariableMetadataRead:
    variable = await repository.get_variable_for_user(
        variable_id=variable_id,
        user_id=development_user_id,
    )
    if variable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variable not found")
    return variable_metadata_response(variable)


@router.patch("/variables/{variable_id}/metadata", response_model=VariableMetadataRead)
async def update_variable_metadata(
    variable_id: UUID,
    data: VariableMetadataUpdate,
    repository: DatasetRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> VariableMetadataRead:
    variable = await repository.get_variable_for_user(
        variable_id=variable_id,
        user_id=development_user_id,
    )
    if variable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variable not found")
    apply_manual_metadata(variable, data)
    try:
        variable = await repository.save_variable(variable)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Variable metadata could not be saved.",
        ) from exc
    return variable_metadata_response(variable)


@router.post(
    "/dataset-versions/{version_id}/classifications/detect",
    response_model=VariableClassificationBatch,
)
async def detect_variable_classifications(
    version_id: UUID,
    repository: DatasetRepositoryDependency,
    development_user_id: DevelopmentUserId,
) -> VariableClassificationBatch:
    variables = await repository.list_variables_for_version(
        version_id=version_id,
        user_id=development_user_id,
    )
    if variables is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset version not found",
        )
    for variable in variables:
        apply_detected_metadata(variable)
    try:
        variables = await repository.save_variables(variables)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Variable classifications could not be saved.",
        ) from exc
    return VariableClassificationBatch(
        version_id=version_id,
        variables=[variable_metadata_response(variable) for variable in variables],
    )
