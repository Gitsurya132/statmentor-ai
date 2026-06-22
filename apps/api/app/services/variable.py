from __future__ import annotations

from typing import Any, cast

from app.classification.engine import (
    ClassificationResult,
    ScaleDetectionResult,
    classification_profile,
    classify_variable,
    detect_scale,
    measurement_level_for_scale,
    scale_profile,
)
from app.db.models.dataset import Variable
from app.schemas.variable import VariableMetadataRead, VariableMetadataUpdate


def apply_detected_metadata(variable: Variable) -> None:
    role_result = classify_variable(variable)
    scale_result = detect_scale(variable)
    profile = dict(variable.profile or {})
    profile["classification"] = classification_profile(role_result, source="detected")
    profile["scale_detection"] = scale_profile(scale_result, source="detected")
    variable.profile = profile
    variable.measurement_level = measurement_level_for_scale(scale_result.scale_type)


def apply_manual_metadata(variable: Variable, data: VariableMetadataUpdate) -> None:
    profile = dict(variable.profile or {})
    if data.role is not None:
        role_result = ClassificationResult(
            role=data.role,
            confidence=cast(float, data.role_confidence),
            explanation=str(data.role_explanation),
        )
        profile["classification"] = classification_profile(role_result, source="manual")
    if data.scale_type is not None:
        scale_result = ScaleDetectionResult(
            scale_type=data.scale_type,
            confidence=cast(float, data.scale_confidence),
            explanation=str(data.scale_explanation),
        )
        profile["scale_detection"] = scale_profile(scale_result, source="manual")
        variable.measurement_level = measurement_level_for_scale(data.scale_type)
    variable.profile = profile


def variable_metadata_response(variable: Variable) -> VariableMetadataRead:
    profile: dict[str, Any] = variable.profile or {}
    return VariableMetadataRead(
        id=variable.id,
        dataset_version_id=variable.dataset_version_id,
        source_name=variable.source_name,
        storage_name=variable.storage_name,
        display_name=variable.display_name,
        data_type=variable.data_type,
        measurement_level=variable.measurement_level,
        ordinal_position=variable.ordinal_position,
        profile=profile,
        classification=profile.get("classification"),
        scale_detection=profile.get("scale_detection"),
        created_at=variable.created_at,
        updated_at=variable.updated_at,
    )
