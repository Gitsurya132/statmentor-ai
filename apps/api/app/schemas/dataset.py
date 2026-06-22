from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.db.enums import (
    DatasetFormat,
    DatasetVersionStatus,
    MeasurementLevel,
    VariableDataType,
)
from app.schemas.base import ORMModel


class DatasetRead(ORMModel):
    id: UUID
    project_id: UUID
    name: str
    description: str | None
    source_format: DatasetFormat
    created_at: datetime
    updated_at: datetime


class DatasetListResponse(BaseModel):
    items: list[DatasetRead]
    page: int
    page_size: int
    total: int


class DatasetVersionRead(ORMModel):
    id: UUID
    dataset_id: UUID
    project_id: UUID
    version_number: int
    status: DatasetVersionStatus
    original_filename: str
    media_type: str
    file_size_bytes: int
    sha256: str
    row_count: int | None
    column_count: int | None
    import_options: dict[str, Any]
    profile_summary: dict[str, Any]
    software_versions: dict[str, Any]
    error_code: str | None
    error_message: str | None
    created_at: datetime


class DatasetDetail(DatasetRead):
    latest_version: DatasetVersionRead | None


class VariableRead(ORMModel):
    id: UUID
    dataset_version_id: UUID
    source_name: str
    storage_name: str
    display_name: str
    data_type: VariableDataType
    measurement_level: MeasurementLevel
    ordinal_position: int
    value_labels: dict[str, Any]
    missing_rules: dict[str, Any]
    profile: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class DatasetPreview(BaseModel):
    version_id: UUID
    offset: int
    limit: int
    total_rows: int
    columns: list[str]
    rows: list[dict[str, Any]]
