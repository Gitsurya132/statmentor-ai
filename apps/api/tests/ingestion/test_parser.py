from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.db.enums import DatasetFormat, MeasurementLevel, VariableDataType
from app.ingestion.parser import parse_dataset, read_preview


def test_parse_csv_profiles_and_normalizes_columns(tmp_path: Path) -> None:
    source = tmp_path / "study.csv"
    normalized = tmp_path / "normalized.csv"
    source.write_text(
        "Participant ID,Score,Group\n1,10.5,A\n2,12.0,B\n3,,A\n",
        encoding="utf-8",
    )

    parsed = parse_dataset(
        source_path=source,
        normalized_path=normalized,
        source_format=DatasetFormat.CSV,
        import_options={},
    )

    assert parsed.row_count == 3
    assert parsed.column_count == 3
    assert parsed.profile_summary["missing_cell_count"] == 1
    assert [variable.storage_name for variable in parsed.variables] == [
        "participant_id",
        "score",
        "group",
    ]
    assert parsed.variables[0].data_type is VariableDataType.INTEGER
    assert parsed.variables[1].measurement_level is MeasurementLevel.SCALE
    assert parsed.variables[2].measurement_level is MeasurementLevel.NOMINAL
    assert normalized.exists()

    columns, rows = read_preview(normalized_path=normalized, offset=1, limit=2)
    assert columns == ["participant_id", "score", "group"]
    assert len(rows) == 2
    assert rows[0]["participant_id"] == 2


def test_parse_excel_file(tmp_path: Path) -> None:
    source = tmp_path / "study.xlsx"
    normalized = tmp_path / "normalized.csv"
    pd.DataFrame({"Age": [25, 30], "Cohort": ["A", "B"]}).to_excel(source, index=False)

    parsed = parse_dataset(
        source_path=source,
        normalized_path=normalized,
        source_format=DatasetFormat.EXCEL,
        import_options={"sheet_name": 0},
    )

    assert parsed.row_count == 2
    assert parsed.column_count == 2
    assert [variable.storage_name for variable in parsed.variables] == ["age", "cohort"]
