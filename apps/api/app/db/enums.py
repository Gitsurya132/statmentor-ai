from __future__ import annotations

from enum import StrEnum


class UserStatus(StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"
    DELETED = "deleted"


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class DatasetFormat(StrEnum):
    CSV = "csv"
    EXCEL = "excel"


class DatasetVersionStatus(StrEnum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class VariableDataType(StrEnum):
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    STRING = "string"
    DATE = "date"
    DATETIME = "datetime"


class MeasurementLevel(StrEnum):
    NOMINAL = "nominal"
    ORDINAL = "ordinal"
    SCALE = "scale"
    UNKNOWN = "unknown"


class AnalysisMethod(StrEnum):
    DESCRIPTIVE_STATISTICS = "descriptive_statistics"
    PEARSON_CORRELATION = "pearson_correlation"
    SPEARMAN_CORRELATION = "spearman_correlation"
    INDEPENDENT_T_TEST = "independent_t_test"
    ONE_WAY_ANOVA = "one_way_anova"
    LINEAR_REGRESSION = "linear_regression"
    CRONBACH_ALPHA = "cronbach_alpha"


class AnalysisStatus(StrEnum):
    DRAFT = "draft"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportStatus(StrEnum):
    DRAFT = "draft"
    FINAL = "final"
