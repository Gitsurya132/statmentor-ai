from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, cast

import numpy as np
import pandas as pd
from pandas.api import types as pandas_types

from app.db.enums import DatasetFormat, MeasurementLevel, VariableDataType
from app.ingestion.exceptions import InvalidDatasetFileError


@dataclass(frozen=True)
class ParsedVariable:
    source_name: str
    storage_name: str
    display_name: str
    data_type: VariableDataType
    measurement_level: MeasurementLevel
    ordinal_position: int
    profile: dict[str, Any]


@dataclass(frozen=True)
class ParsedDataset:
    row_count: int
    column_count: int
    profile_summary: dict[str, Any]
    variables: list[ParsedVariable]
    normalized_path: Path


def parse_dataset(
    *,
    source_path: Path,
    normalized_path: Path,
    source_format: DatasetFormat,
    import_options: dict[str, Any],
) -> ParsedDataset:
    try:
        frame = _read_frame(source_path, source_format, import_options)
    except Exception as exc:
        raise InvalidDatasetFileError("The uploaded file could not be parsed.") from exc

    if len(frame.columns) == 0:
        raise InvalidDatasetFileError("The uploaded file contains no columns.")

    source_names = [
        str(column).strip() or f"column_{index + 1}" for index, column in enumerate(frame)
    ]
    storage_names = _unique_storage_names(source_names)
    frame.columns = storage_names

    variables = [
        _profile_variable(
            frame[storage_name],
            source_name=source_name,
            storage_name=storage_name,
            ordinal_position=index,
        )
        for index, (source_name, storage_name) in enumerate(
            zip(source_names, storage_names, strict=True)
        )
    ]

    normalized_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(normalized_path, index=False)

    missing_cells = int(frame.isna().sum().sum())
    total_cells = int(frame.shape[0] * frame.shape[1])
    profile_summary = {
        "row_count": int(frame.shape[0]),
        "column_count": int(frame.shape[1]),
        "missing_cell_count": missing_cells,
        "missing_cell_percentage": _round_number(
            (missing_cells / total_cells * 100) if total_cells else 0.0
        ),
        "duplicate_row_count": int(frame.duplicated().sum()),
        "columns": [
            {
                "name": variable.storage_name,
                "data_type": variable.data_type.value,
                "measurement_level": variable.measurement_level.value,
                "missing_count": variable.profile["missing_count"],
                "unique_count": variable.profile["unique_count"],
            }
            for variable in variables
        ],
    }
    return ParsedDataset(
        row_count=int(frame.shape[0]),
        column_count=int(frame.shape[1]),
        profile_summary=profile_summary,
        variables=variables,
        normalized_path=normalized_path,
    )


def read_preview(
    *,
    normalized_path: Path,
    offset: int,
    limit: int,
) -> tuple[list[str], list[dict[str, Any]]]:
    try:
        frame = pd.read_csv(normalized_path, skiprows=range(1, offset + 1), nrows=limit)
    except Exception as exc:
        raise InvalidDatasetFileError("The normalized dataset could not be read.") from exc
    frame = frame.replace({np.nan: None})
    rows = [
        {str(key): _json_value(value) for key, value in record.items()}
        for record in frame.to_dict(orient="records")
    ]
    return [str(column) for column in frame.columns], rows


def _read_frame(
    path: Path,
    source_format: DatasetFormat,
    options: dict[str, Any],
) -> pd.DataFrame:
    header_row = int(options.get("header_row", 0))
    if header_row < 0:
        raise InvalidDatasetFileError("header_row must be zero or greater.")

    if source_format is DatasetFormat.CSV:
        return pd.read_csv(
            path,
            header=header_row,
            encoding=str(options.get("encoding", "utf-8")),
            sep=str(options.get("delimiter", ",")),
            decimal=str(options.get("decimal", ".")),
            na_values=options.get("missing_values"),
        )

    return cast(
        pd.DataFrame,
        pd.read_excel(
            path,
            header=header_row,
            sheet_name=options.get("sheet_name", 0),
            na_values=options.get("missing_values"),
        ),
    )


def _unique_storage_names(source_names: list[str]) -> list[str]:
    used: set[str] = set()
    names: list[str] = []
    for position, source_name in enumerate(source_names, start=1):
        base = re.sub(r"[^a-z0-9]+", "_", source_name.lower()).strip("_")
        base = base or f"column_{position}"
        candidate = base
        suffix = 2
        while candidate in used:
            candidate = f"{base}_{suffix}"
            suffix += 1
        used.add(candidate)
        names.append(candidate)
    return names


def _profile_variable(
    series: pd.Series,
    *,
    source_name: str,
    storage_name: str,
    ordinal_position: int,
) -> ParsedVariable:
    data_type = _infer_data_type(series)
    measurement_level = _infer_measurement_level(series, data_type)
    non_missing = series.dropna()
    profile: dict[str, Any] = {
        "missing_count": int(series.isna().sum()),
        "non_missing_count": int(series.notna().sum()),
        "unique_count": int(non_missing.nunique(dropna=True)),
    }

    if data_type in {VariableDataType.INTEGER, VariableDataType.FLOAT} and not non_missing.empty:
        numeric = pd.to_numeric(non_missing, errors="coerce").dropna()
        profile.update(
            {
                "minimum": _json_value(numeric.min()),
                "maximum": _json_value(numeric.max()),
                "mean": _json_value(numeric.mean()),
                "standard_deviation": (
                    _json_value(numeric.std(ddof=1)) if len(numeric) > 1 else None
                ),
            }
        )
    else:
        top_values = non_missing.astype(str).value_counts().head(10)
        profile["top_values"] = [
            {"value": value, "count": int(count)} for value, count in top_values.items()
        ]

    return ParsedVariable(
        source_name=source_name,
        storage_name=storage_name,
        display_name=source_name,
        data_type=data_type,
        measurement_level=measurement_level,
        ordinal_position=ordinal_position,
        profile=profile,
    )


def _infer_data_type(series: pd.Series) -> VariableDataType:
    if pandas_types.is_bool_dtype(series.dtype):
        return VariableDataType.BOOLEAN
    if pandas_types.is_integer_dtype(series.dtype):
        return VariableDataType.INTEGER
    if pandas_types.is_float_dtype(series.dtype):
        non_missing = series.dropna()
        if not non_missing.empty and np.all(np.equal(np.mod(non_missing, 1), 0)):
            return VariableDataType.INTEGER
        return VariableDataType.FLOAT
    if pandas_types.is_datetime64_any_dtype(series.dtype):
        return VariableDataType.DATETIME
    sample = series.dropna().head(100)
    if not sample.empty and all(isinstance(value, datetime) for value in sample):
        return VariableDataType.DATETIME
    if not sample.empty and all(isinstance(value, date) for value in sample):
        return VariableDataType.DATE
    return VariableDataType.STRING


def _infer_measurement_level(
    series: pd.Series,
    data_type: VariableDataType,
) -> MeasurementLevel:
    if isinstance(series.dtype, pd.CategoricalDtype) and series.dtype.ordered:
        return MeasurementLevel.ORDINAL
    if data_type in {VariableDataType.INTEGER, VariableDataType.FLOAT}:
        return MeasurementLevel.SCALE
    return MeasurementLevel.NOMINAL


def _json_value(value: Any) -> Any:
    if value is None or value is pd.NA:
        return None
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    return value


def _round_number(value: float) -> float:
    return round(float(value), 4)
