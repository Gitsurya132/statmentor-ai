from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.classification.engine import ScaleType, VariableRole
from app.db.enums import MeasurementLevel, VariableDataType


class VariableClassification(BaseModel):
    role: VariableRole
    confidence: float = Field(ge=0, le=1)
    explanation: str = Field(min_length=1)
    source: str


class VariableScaleDetection(BaseModel):
    scale_type: ScaleType
    confidence: float = Field(ge=0, le=1)
    explanation: str = Field(min_length=1)
    source: str


class VariableMetadataRead(BaseModel):
    id: UUID
    dataset_version_id: UUID
    source_name: str
    storage_name: str
    display_name: str
    data_type: VariableDataType
    measurement_level: MeasurementLevel
    ordinal_position: int
    profile: dict[str, Any]
    classification: VariableClassification | None
    scale_detection: VariableScaleDetection | None
    created_at: datetime
    updated_at: datetime


class VariableMetadataUpdate(BaseModel):
    role: VariableRole | None = None
    role_confidence: float | None = Field(default=None, ge=0, le=1)
    role_explanation: str | None = Field(default=None, min_length=1)
    scale_type: ScaleType | None = None
    scale_confidence: float | None = Field(default=None, ge=0, le=1)
    scale_explanation: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def validate_complete_updates(self) -> VariableMetadataUpdate:
        role_fields = (self.role, self.role_confidence, self.role_explanation)
        scale_fields = (self.scale_type, self.scale_confidence, self.scale_explanation)
        if any(value is not None for value in role_fields) and not all(
            value is not None for value in role_fields
        ):
            raise ValueError(
                "role, role_confidence, and role_explanation must be supplied together"
            )
        if any(value is not None for value in scale_fields) and not all(
            value is not None for value in scale_fields
        ):
            raise ValueError(
                "scale_type, scale_confidence, and scale_explanation must be supplied together"
            )
        if all(value is None for value in (*role_fields, *scale_fields)):
            raise ValueError("At least one complete metadata update is required")
        return self


class VariableClassificationBatch(BaseModel):
    version_id: UUID
    variables: list[VariableMetadataRead]
