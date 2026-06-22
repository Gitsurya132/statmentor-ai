from __future__ import annotations


class DatasetIngestionError(Exception):
    """Base error for user-correctable ingestion failures."""


class UnsupportedDatasetFormatError(DatasetIngestionError):
    """The uploaded file is not a supported CSV or Excel file."""


class InvalidDatasetFileError(DatasetIngestionError):
    """The uploaded file cannot be parsed as a valid tabular dataset."""


class DatasetTooLargeError(DatasetIngestionError):
    """The uploaded file exceeds the configured MVP size limit."""
