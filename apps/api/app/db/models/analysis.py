from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import AnalysisMethod, AnalysisStatus
from app.db.models.common import CreatedAtMixin, UpdatedAtMixin
from app.db.types import postgres_enum


class Analysis(UpdatedAtMixin, Base):
    __tablename__ = "analyses"
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name="analyses_project_fk", ondelete="CASCADE"
        ),
        ForeignKeyConstraint(
            ["dataset_version_id", "project_id"],
            ["dataset_versions.id", "dataset_versions.project_id"],
            name="analyses_dataset_version_fk",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["research_question_id", "project_id"],
            ["research_questions.id", "research_questions.project_id"],
            name="analyses_question_project_fk",
            ondelete="SET NULL (research_question_id)",
        ),
        CheckConstraint("btrim(name) <> ''", name="analyses_name_not_blank"),
        CheckConstraint(
            "jsonb_typeof(specification) = 'object'",
            name="analyses_specification_object",
        ),
        CheckConstraint(
            "CASE "
            "WHEN NOT (specification ? 'confidence_level') THEN true "
            "WHEN jsonb_typeof(specification -> 'confidence_level') <> 'number' THEN false "
            "ELSE (specification ->> 'confidence_level')::numeric > 0.50 "
            "AND (specification ->> 'confidence_level')::numeric < 1.00 END",
            name="analyses_confidence_level_valid",
        ),
        CheckConstraint(
            "jsonb_typeof(software_versions) = 'object'",
            name="analyses_software_versions_object",
        ),
        CheckConstraint(
            "btrim(spec_schema_version) <> ''",
            name="analyses_schema_version_not_blank",
        ),
        CheckConstraint(
            "status <> 'completed' OR (completed_at IS NOT NULL AND error_code IS NULL)",
            name="analyses_completed_timestamp",
        ),
        CheckConstraint(
            "status <> 'failed' OR error_code IS NOT NULL",
            name="analyses_failed_error",
        ),
        CheckConstraint(
            "started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at",
            name="analyses_time_order",
        ),
        UniqueConstraint("id", "project_id", name="analyses_id_project_unique"),
        Index("analyses_project_created_idx", "project_id", text("created_at DESC")),
        Index("analyses_project_method_idx", "project_id", "method"),
        Index("analyses_project_status_idx", "project_id", "status"),
        Index("analyses_dataset_version_idx", "dataset_version_id"),
        Index(
            "analyses_research_question_idx",
            "research_question_id",
            postgresql_where=text("research_question_id IS NOT NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    dataset_version_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    research_question_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    method: Mapped[AnalysisMethod] = mapped_column(
        postgres_enum(AnalysisMethod, "analysis_method"), nullable=False
    )
    status: Mapped[AnalysisStatus] = mapped_column(
        postgres_enum(AnalysisStatus, "analysis_status"),
        nullable=False,
        server_default=text("'draft'::analysis_status"),
    )
    specification: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    spec_schema_version: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'1.0'")
    )
    software_versions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)


class AnalysisResult(CreatedAtMixin, Base):
    __tablename__ = "analysis_results"
    __table_args__ = (
        CheckConstraint("run_number > 0", name="analysis_results_run_positive"),
        CheckConstraint(
            "btrim(result_schema_version) <> ''",
            name="analysis_results_schema_version_not_blank",
        ),
        CheckConstraint(
            "jsonb_typeof(sample_summary) = 'object'",
            name="analysis_results_sample_summary_object",
        ),
        CheckConstraint(
            "jsonb_typeof(estimates) = 'object'",
            name="analysis_results_estimates_object",
        ),
        CheckConstraint(
            "jsonb_typeof(assumptions) = 'object'",
            name="analysis_results_assumptions_object",
        ),
        CheckConstraint(
            "jsonb_typeof(diagnostics) = 'object'",
            name="analysis_results_diagnostics_object",
        ),
        CheckConstraint(
            "jsonb_typeof(warnings) = 'array'",
            name="analysis_results_warnings_array",
        ),
        CheckConstraint("jsonb_typeof(tables) = 'array'", name="analysis_results_tables_array"),
        CheckConstraint("jsonb_typeof(figures) = 'array'", name="analysis_results_figures_array"),
        CheckConstraint(
            "jsonb_typeof(provenance) = 'object'",
            name="analysis_results_provenance_object",
        ),
        ForeignKeyConstraint(
            ["analysis_id", "project_id"],
            ["analyses.id", "analyses.project_id"],
            name="analysis_results_analysis_project_fk",
            ondelete="CASCADE",
        ),
        UniqueConstraint("analysis_id", "run_number", name="analysis_results_analysis_run_unique"),
        UniqueConstraint("id", "analysis_id", name="analysis_results_id_analysis_unique"),
        UniqueConstraint("id", "project_id", name="analysis_results_id_project_unique"),
        Index("analysis_results_analysis_created_idx", "analysis_id", text("created_at DESC")),
        Index("analysis_results_project_idx", "project_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    analysis_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    project_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    run_number: Mapped[int] = mapped_column(Integer, nullable=False)
    result_schema_version: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'1.0'")
    )
    sample_summary: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    estimates: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    assumptions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    diagnostics: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    warnings: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    apa_narrative: Mapped[str | None] = mapped_column(Text)
    tables: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    figures: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    provenance: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
