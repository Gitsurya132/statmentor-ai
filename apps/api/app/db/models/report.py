from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import ReportStatus
from app.db.models.common import UpdatedAtMixin
from app.db.types import postgres_enum


class Report(UpdatedAtMixin, Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("btrim(title) <> ''", name="reports_title_not_blank"),
        CheckConstraint("btrim(apa_version) <> ''", name="reports_apa_version_not_blank"),
        CheckConstraint(
            "jsonb_typeof(document_model) = 'object'",
            name="reports_document_model_object",
        ),
        ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name="reports_project_fk", ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["analysis_result_id", "project_id"],
            ["analysis_results.id", "analysis_results.project_id"],
            name="reports_result_project_fk",
            ondelete="CASCADE",
        ),
        Index("reports_project_created_idx", "project_id", text("created_at DESC")),
        Index("reports_result_idx", "analysis_result_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    analysis_result_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    status: Mapped[ReportStatus] = mapped_column(
        postgres_enum(ReportStatus, "report_status"),
        nullable=False,
        server_default=text("'draft'::report_status"),
    )
    apa_version: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'7'"))
    document_model: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    export_storage_key: Mapped[str | None] = mapped_column(Text)
