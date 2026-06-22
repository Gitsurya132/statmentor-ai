from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from app.db.enums import ReportStatus
from app.schemas.base import ORMModel


class ReportRead(ORMModel):
    id: UUID
    project_id: UUID
    analysis_result_id: UUID
    title: str
    status: ReportStatus
    apa_version: str
    document_model: dict[str, Any]
    export_storage_key: str | None
    created_at: datetime
    updated_at: datetime
