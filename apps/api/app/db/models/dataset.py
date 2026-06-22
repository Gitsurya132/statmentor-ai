from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
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
from app.db.enums import (
    DatasetFormat,
    DatasetVersionStatus,
    MeasurementLevel,
    VariableDataType,
)
from app.db.models.common import CreatedAtMixin, UpdatedAtMixin
from app.db.types import postgres_enum


class Dataset(UpdatedAtMixin, Base):
    __tablename__ = "datasets"
    __table_args__ = (
        CheckConstraint("btrim(name) <> ''", name="datasets_name_not_blank"),
        ForeignKeyConstraint(
            ["project_id"], ["projects.id"], name="datasets_project_fk", ondelete="CASCADE"
        ),
        UniqueConstraint("id", "project_id", name="datasets_id_project_unique"),
        Index("datasets_project_name_ci_unique", "project_id", text("lower(name)"), unique=True),
        Index("datasets_project_created_idx", "project_id", text("created_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    source_format: Mapped[DatasetFormat] = mapped_column(
        postgres_enum(DatasetFormat, "dataset_format"), nullable=False
    )


class DatasetVersion(CreatedAtMixin, Base):
    __tablename__ = "dataset_versions"
    __table_args__ = (
        CheckConstraint("version_number > 0", name="dataset_versions_number_positive"),
        CheckConstraint(
            "btrim(original_filename) <> ''", name="dataset_versions_filename_not_blank"
        ),
        CheckConstraint("btrim(media_type) <> ''", name="dataset_versions_media_type_not_blank"),
        CheckConstraint(
            "btrim(source_storage_key) <> ''", name="dataset_versions_source_key_not_blank"
        ),
        CheckConstraint("file_size_bytes > 0", name="dataset_versions_file_size_positive"),
        CheckConstraint("sha256 ~ '^[0-9a-f]{64}$'", name="dataset_versions_sha256_hex"),
        CheckConstraint(
            "row_count IS NULL OR row_count >= 0",
            name="dataset_versions_row_count_nonnegative",
        ),
        CheckConstraint(
            "column_count IS NULL OR column_count > 0",
            name="dataset_versions_column_count_positive",
        ),
        CheckConstraint(
            "jsonb_typeof(import_options) = 'object'",
            name="dataset_versions_import_options_object",
        ),
        CheckConstraint(
            "jsonb_typeof(profile_summary) = 'object'",
            name="dataset_versions_profile_summary_object",
        ),
        CheckConstraint(
            "jsonb_typeof(software_versions) = 'object'",
            name="dataset_versions_software_versions_object",
        ),
        CheckConstraint(
            "status <> 'ready' OR "
            "(normalized_storage_key IS NOT NULL AND row_count IS NOT NULL "
            "AND column_count IS NOT NULL AND error_code IS NULL)",
            name="dataset_versions_ready_fields",
        ),
        CheckConstraint(
            "status <> 'failed' OR error_code IS NOT NULL",
            name="dataset_versions_failed_error",
        ),
        ForeignKeyConstraint(
            ["dataset_id", "project_id"],
            ["datasets.id", "datasets.project_id"],
            name="dataset_versions_dataset_project_fk",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "dataset_id", "version_number", name="dataset_versions_dataset_version_unique"
        ),
        UniqueConstraint("id", "dataset_id", name="dataset_versions_id_dataset_unique"),
        UniqueConstraint("id", "project_id", name="dataset_versions_id_project_unique"),
        Index("dataset_versions_dataset_created_idx", "dataset_id", text("created_at DESC")),
        Index("dataset_versions_project_idx", "project_id"),
        Index("dataset_versions_status_idx", "status"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    dataset_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    project_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[DatasetVersionStatus] = mapped_column(
        postgres_enum(DatasetVersionStatus, "dataset_version_status"),
        nullable=False,
        server_default=text("'processing'::dataset_version_status"),
    )
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    media_type: Mapped[str] = mapped_column(String(150), nullable=False)
    source_storage_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    normalized_storage_key: Mapped[str | None] = mapped_column(Text, unique=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    row_count: Mapped[int | None] = mapped_column(BigInteger)
    column_count: Mapped[int | None] = mapped_column(Integer)
    import_options: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    profile_summary: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    software_versions: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)


class Variable(UpdatedAtMixin, Base):
    __tablename__ = "variables"
    __table_args__ = (
        CheckConstraint("btrim(source_name) <> ''", name="variables_source_name_not_blank"),
        CheckConstraint("btrim(storage_name) <> ''", name="variables_storage_name_not_blank"),
        CheckConstraint("btrim(display_name) <> ''", name="variables_display_name_not_blank"),
        CheckConstraint("ordinal_position >= 0", name="variables_position_nonnegative"),
        CheckConstraint(
            "jsonb_typeof(value_labels) = 'object'", name="variables_value_labels_object"
        ),
        CheckConstraint(
            "jsonb_typeof(missing_rules) = 'object'", name="variables_missing_rules_object"
        ),
        CheckConstraint("jsonb_typeof(profile) = 'object'", name="variables_profile_object"),
        ForeignKeyConstraint(
            ["dataset_version_id"],
            ["dataset_versions.id"],
            name="variables_dataset_version_fk",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "dataset_version_id", "storage_name", name="variables_storage_name_unique"
        ),
        UniqueConstraint(
            "dataset_version_id", "ordinal_position", name="variables_position_unique"
        ),
        UniqueConstraint("id", "dataset_version_id", name="variables_id_version_unique"),
        Index("variables_version_position_idx", "dataset_version_id", "ordinal_position"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    dataset_version_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    storage_name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    data_type: Mapped[VariableDataType] = mapped_column(
        postgres_enum(VariableDataType, "variable_data_type"), nullable=False
    )
    measurement_level: Mapped[MeasurementLevel] = mapped_column(
        postgres_enum(MeasurementLevel, "measurement_level"),
        nullable=False,
        server_default=text("'unknown'::measurement_level"),
    )
    ordinal_position: Mapped[int] = mapped_column(Integer, nullable=False)
    value_labels: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    missing_rules: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    profile: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
