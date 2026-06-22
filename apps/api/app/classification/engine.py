from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from app.db.enums import MeasurementLevel, VariableDataType
from app.db.models.dataset import Variable


class VariableRole(StrEnum):
    INDEPENDENT_VARIABLE = "independent_variable"
    DEPENDENT_VARIABLE = "dependent_variable"
    MEDIATOR = "mediator"
    MODERATOR = "moderator"
    CONTROL_VARIABLE = "control_variable"
    CONFOUNDING_VARIABLE = "confounding_variable"
    OTHER = "other"


class ScaleType(StrEnum):
    NOMINAL = "nominal"
    ORDINAL = "ordinal"
    INTERVAL = "interval"
    RATIO = "ratio"


@dataclass(frozen=True)
class ClassificationResult:
    role: VariableRole
    confidence: float
    explanation: str


@dataclass(frozen=True)
class ScaleDetectionResult:
    scale_type: ScaleType
    confidence: float
    explanation: str


ROLE_KEYWORDS: tuple[tuple[VariableRole, tuple[str, ...]], ...] = (
    (VariableRole.MEDIATOR, ("mediator", "mediation", "indirect")),
    (VariableRole.MODERATOR, ("moderator", "moderation", "interaction")),
    (VariableRole.CONFOUNDING_VARIABLE, ("confound", "confounding")),
    (VariableRole.CONTROL_VARIABLE, ("control", "covariate", "baseline")),
    (
        VariableRole.DEPENDENT_VARIABLE,
        ("outcome", "dependent", "performance", "result"),
    ),
    (
        VariableRole.INDEPENDENT_VARIABLE,
        ("predictor", "independent", "exposure", "treatment"),
    ),
)


def classify_variable(variable: Variable) -> ClassificationResult:
    name = f"{variable.source_name} {variable.display_name} {variable.storage_name}".lower()
    for role, keywords in ROLE_KEYWORDS:
        matched = next((keyword for keyword in keywords if keyword in name), None)
        if matched is not None:
            return ClassificationResult(
                role=role,
                confidence=0.78,
                explanation=f"The variable name contains the role-related term '{matched}'.",
            )
    return ClassificationResult(
        role=VariableRole.OTHER,
        confidence=0.35,
        explanation=(
            "No reliable role signal was found in the variable metadata. "
            "Research roles depend on the study model and should be reviewed manually."
        ),
    )


def detect_scale(variable: Variable) -> ScaleDetectionResult:
    profile = variable.profile or {}
    unique_count = _integer(profile.get("unique_count"))
    minimum = _number(profile.get("minimum"))
    name = f"{variable.source_name} {variable.display_name}".lower()

    if variable.data_type in {
        VariableDataType.STRING,
        VariableDataType.BOOLEAN,
    }:
        ordinal_terms = ("level", "rank", "rating", "likert", "grade", "severity")
        if any(term in name for term in ordinal_terms):
            return ScaleDetectionResult(
                scale_type=ScaleType.ORDINAL,
                confidence=0.72,
                explanation=(
                    "The variable is categorical and its name suggests ordered categories."
                ),
            )
        return ScaleDetectionResult(
            scale_type=ScaleType.NOMINAL,
            confidence=0.88,
            explanation="The variable contains categorical values without detected ordering.",
        )

    if variable.data_type in {VariableDataType.DATE, VariableDataType.DATETIME}:
        return ScaleDetectionResult(
            scale_type=ScaleType.INTERVAL,
            confidence=0.9,
            explanation=("Dates have meaningful differences but no meaningful absolute zero."),
        )

    if (
        unique_count is not None
        and unique_count <= 10
        and any(term in name for term in ("rating", "score_level", "likert", "grade"))
    ):
        return ScaleDetectionResult(
            scale_type=ScaleType.ORDINAL,
            confidence=0.75,
            explanation=(
                "The numeric variable has few distinct values and metadata suggests an "
                "ordered response scale."
            ),
        )

    if minimum is not None and minimum >= 0:
        return ScaleDetectionResult(
            scale_type=ScaleType.RATIO,
            confidence=0.68,
            explanation=(
                "The variable is numeric and nonnegative, which is consistent with a "
                "meaningful zero. Domain review is still required."
            ),
        )

    return ScaleDetectionResult(
        scale_type=ScaleType.INTERVAL,
        confidence=0.62,
        explanation=(
            "The variable is numeric, but a meaningful absolute zero could not be inferred."
        ),
    )


def measurement_level_for_scale(scale_type: ScaleType) -> MeasurementLevel:
    if scale_type is ScaleType.NOMINAL:
        return MeasurementLevel.NOMINAL
    if scale_type is ScaleType.ORDINAL:
        return MeasurementLevel.ORDINAL
    return MeasurementLevel.SCALE


def classification_profile(
    result: ClassificationResult,
    *,
    source: str,
) -> dict[str, Any]:
    return {
        "role": result.role.value,
        "confidence": result.confidence,
        "explanation": result.explanation,
        "source": source,
    }


def scale_profile(
    result: ScaleDetectionResult,
    *,
    source: str,
) -> dict[str, Any]:
    return {
        "scale_type": result.scale_type.value,
        "confidence": result.confidence,
        "explanation": result.explanation,
        "source": source,
    }


def _integer(value: Any) -> int | None:
    return int(value) if isinstance(value, int | float) else None


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) else None
