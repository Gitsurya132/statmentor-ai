from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from app.classification.engine import ScaleType, VariableRole, classify_variable, detect_scale
from app.db.enums import MeasurementLevel, VariableDataType
from app.db.models.dataset import Variable


def make_variable(
    *,
    name: str,
    data_type: VariableDataType,
    profile: dict[str, object],
) -> Variable:
    now = datetime.now(UTC)
    return Variable(
        id=uuid4(),
        dataset_version_id=uuid4(),
        source_name=name,
        storage_name=name.lower().replace(" ", "_"),
        display_name=name,
        data_type=data_type,
        measurement_level=MeasurementLevel.UNKNOWN,
        ordinal_position=0,
        value_labels={},
        missing_rules={},
        profile=profile,
        created_at=now,
        updated_at=now,
    )


def test_role_classifier_detects_dependent_variable() -> None:
    variable = make_variable(
        name="Employee Performance Outcome",
        data_type=VariableDataType.FLOAT,
        profile={"minimum": 0, "unique_count": 20},
    )

    result = classify_variable(variable)

    assert result.role is VariableRole.DEPENDENT_VARIABLE
    assert result.confidence > 0.5


def test_scale_detector_detects_ratio_numeric_variable() -> None:
    variable = make_variable(
        name="Annual Income",
        data_type=VariableDataType.FLOAT,
        profile={"minimum": 0, "unique_count": 100},
    )

    result = detect_scale(variable)

    assert result.scale_type is ScaleType.RATIO


def test_scale_detector_detects_ordinal_rating() -> None:
    variable = make_variable(
        name="Satisfaction Rating",
        data_type=VariableDataType.INTEGER,
        profile={"minimum": 1, "unique_count": 5},
    )

    result = detect_scale(variable)

    assert result.scale_type is ScaleType.ORDINAL
