from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from app.db.enums import AnalysisMethod, AnalysisStatus
from app.schemas.base import ORMModel


class AnalysisRead(ORMModel):
    id: UUID
    project_id: UUID
    dataset_version_id: UUID
    research_question_id: UUID | None
    name: str
    method: AnalysisMethod
    status: AnalysisStatus
    specification: dict[str, Any]
    spec_schema_version: str
    software_versions: dict[str, Any]
    started_at: datetime | None
    completed_at: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class AnalysisResultRead(ORMModel):
    id: UUID
    analysis_id: UUID
    project_id: UUID
    run_number: int
    result_schema_version: str
    sample_summary: dict[str, Any]
    estimates: dict[str, Any]
    assumptions: dict[str, Any]
    diagnostics: dict[str, Any]
    warnings: list[Any]
    apa_narrative: str | None
    tables: list[Any]
    figures: list[Any]
    provenance: dict[str, Any]
    created_at: datetime
