from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.classification.engine import ScaleType, VariableRole
from app.db.enums import AnalysisMethod, DatasetVersionStatus
from app.db.models.dataset import Variable
from app.recommendations.registry import MethodDefinition, get_method
from app.repositories.dataset import DatasetRepository
from app.repositories.research_design import ResearchDesignRepository
from app.schemas.recommendation import (
    SelectedVariable,
    TestRecommendation,
    TestRecommendationRequest,
    TestRecommendationResponse,
)
from app.schemas.research_question import ResearchDesignCreate, StudyFocus


class RecommendationValidationError(ValueError):
    """The recommendation request conflicts with stored project data."""


@dataclass(frozen=True)
class RecommendationCandidate:
    method: AnalysisMethod
    confidence: float
    reason: str


class RecommendationService:
    def __init__(
        self,
        *,
        dataset_repository: DatasetRepository,
        research_design_repository: ResearchDesignRepository,
    ) -> None:
        self.dataset_repository = dataset_repository
        self.research_design_repository = research_design_repository

    async def recommend(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        request: TestRecommendationRequest,
    ) -> TestRecommendationResponse:
        design = await self.research_design_repository.get_for_user(
            design_id=request.research_design_id,
            user_id=user_id,
        )
        if design is None or design.project_id != project_id:
            raise LookupError("Research design not found")
        version = await self.dataset_repository.get_version_for_user(
            version_id=request.dataset_version_id,
            user_id=user_id,
        )
        if version is None or version.project_id != project_id:
            raise LookupError("Dataset version not found")
        if version.status is not DatasetVersionStatus.READY:
            raise RecommendationValidationError("Dataset version must be ready")

        stored_variables = await self.dataset_repository.list_variables_for_version(
            version_id=request.dataset_version_id,
            user_id=user_id,
        )
        if stored_variables is None:
            raise LookupError("Dataset version not found")
        by_id = {variable.id: variable for variable in stored_variables}
        for selected in request.variables:
            stored = by_id.get(selected.variable_id)
            if stored is None:
                raise RecommendationValidationError(
                    f"Variable {selected.variable_id} does not belong to the dataset version"
                )
            _validate_stored_metadata(stored, selected)

        design_data = ResearchDesignCreate.model_validate(design.structured_context)
        candidates = _rank_candidates(
            design=design_data,
            variables=request.variables,
            sample_size=design_data.sample_size,
            stored_variables=by_id,
        )
        recommendations = [
            _recommendation_response(candidate) for candidate in candidates[:4]
        ]
        return TestRecommendationResponse(
            project_id=project_id,
            research_design_id=request.research_design_id,
            dataset_version_id=request.dataset_version_id,
            recommendations=recommendations,
            advisory_note=(
                "Recommendations are design guidance only. Assumptions and data adequacy "
                "must be checked before executing a statistical test."
            ),
        )


def _rank_candidates(
    *,
    design: ResearchDesignCreate,
    variables: list[SelectedVariable],
    sample_size: int | None,
    stored_variables: dict[UUID, Variable],
) -> list[RecommendationCandidate]:
    candidates: dict[AnalysisMethod, RecommendationCandidate] = {}

    def add(method: AnalysisMethod, confidence: float, reason: str) -> None:
        adjusted = _sample_adjustment(confidence, sample_size)
        current = candidates.get(method)
        candidate = RecommendationCandidate(method, adjusted, reason)
        if current is None or candidate.confidence > current.confidence:
            candidates[method] = candidate

    add(
        AnalysisMethod.DESCRIPTIVE_STATISTICS,
        0.98,
        "Descriptive summaries are appropriate for the selected variables and should "
        "precede inferential analysis.",
    )

    ivs = _with_role(variables, VariableRole.INDEPENDENT_VARIABLE)
    dvs = _with_role(variables, VariableRole.DEPENDENT_VARIABLE)
    scale_variables = _with_scales(variables, ScaleType.INTERVAL, ScaleType.RATIO)
    ordered_variables = _with_scales(
        variables,
        ScaleType.ORDINAL,
        ScaleType.INTERVAL,
        ScaleType.RATIO,
    )
    adjustment_variables = [
        variable
        for variable in variables
        if variable.role
        in {
            VariableRole.CONTROL_VARIABLE,
            VariableRole.CONFOUNDING_VARIABLE,
            VariableRole.MODERATOR,
            VariableRole.MEDIATOR,
        }
    ]

    if design.study_focus in {StudyFocus.RELATIONSHIP, StudyFocus.BOTH}:
        if len(scale_variables) >= 2:
            add(
                AnalysisMethod.PEARSON_CORRELATION,
                0.88,
                "The design examines relationships and at least two selected variables "
                "are interval or ratio scaled.",
            )
        if len(ordered_variables) >= 2:
            add(
                AnalysisMethod.SPEARMAN_CORRELATION,
                0.82 if len(scale_variables) < 2 else 0.72,
                "The design examines relationships and at least two variables are ordinal "
                "or continuous, making a rank-based association plausible.",
            )
        if dvs and ivs and dvs[0].scale_type in {ScaleType.INTERVAL, ScaleType.RATIO}:
            confidence = 0.91 if adjustment_variables or len(ivs) > 1 else 0.84
            add(
                AnalysisMethod.LINEAR_REGRESSION,
                confidence,
                "A continuous dependent variable and one or more predictors are selected"
                + (
                    ", including adjustment or conceptual model variables."
                    if adjustment_variables
                    else "."
                ),
            )

    if design.study_focus in {StudyFocus.COMPARISON, StudyFocus.BOTH} and dvs:
        continuous_dv = next(
            (
                variable
                for variable in dvs
                if variable.scale_type in {ScaleType.INTERVAL, ScaleType.RATIO}
            ),
            None,
        )
        nominal_iv = next(
            (variable for variable in ivs if variable.scale_type is ScaleType.NOMINAL),
            None,
        )
        if continuous_dv and nominal_iv:
            unique_count = _stored_unique_count(stored_variables[nominal_iv.variable_id])
            if unique_count == 2:
                add(
                    AnalysisMethod.INDEPENDENT_T_TEST,
                    0.92,
                    "The selected nominal independent variable has two observed groups and "
                    "the dependent variable is continuous.",
                )
            elif unique_count is not None and unique_count >= 3:
                add(
                    AnalysisMethod.ONE_WAY_ANOVA,
                    0.92,
                    "The selected nominal independent variable has three or more observed "
                    "groups and the dependent variable is continuous.",
                )
            else:
                add(
                    AnalysisMethod.INDEPENDENT_T_TEST,
                    0.62,
                    "A two-group comparison may fit, but group cardinality must be confirmed.",
                )
                add(
                    AnalysisMethod.ONE_WAY_ANOVA,
                    0.6,
                    "A multi-group comparison may fit, but group cardinality must be confirmed.",
                )

    reliability_items = [
        variable
        for variable in variables
        if variable.role is VariableRole.OTHER
        and variable.scale_type
        in {ScaleType.ORDINAL, ScaleType.INTERVAL, ScaleType.RATIO}
    ]
    text = " ".join([*design.research_questions, *design.hypotheses]).lower()
    reliability_signal = any(
        word in text for word in ("reliability", "internal consistency", "scale items")
    )
    if len(reliability_items) >= 2 and reliability_signal:
        add(
            AnalysisMethod.CRONBACH_ALPHA,
            0.9,
            "The design references reliability or scale items and multiple eligible item "
            "variables are selected.",
        )

    return sorted(candidates.values(), key=lambda item: item.confidence, reverse=True)


def _recommendation_response(candidate: RecommendationCandidate) -> TestRecommendation:
    metadata: MethodDefinition = get_method(candidate.method)
    return TestRecommendation(
        method_key=metadata.method_key,
        method_name=metadata.method_name,
        why_recommended=candidate.reason,
        required_variables=metadata.required_variables,
        assumptions=metadata.assumptions,
        sample_size_guidance=metadata.sample_size_guidance,
        advantages=metadata.advantages,
        limitations=metadata.limitations,
        alternatives=metadata.alternatives,
        confidence_score=round(candidate.confidence, 2),
    )


def _with_role(
    variables: list[SelectedVariable], role: VariableRole
) -> list[SelectedVariable]:
    return [variable for variable in variables if variable.role is role]


def _with_scales(
    variables: list[SelectedVariable],
    *scales: ScaleType,
) -> list[SelectedVariable]:
    return [variable for variable in variables if variable.scale_type in scales]


def _sample_adjustment(confidence: float, sample_size: int | None) -> float:
    if sample_size is None:
        return min(confidence, 0.82)
    if sample_size < 20:
        return max(0.35, confidence - 0.2)
    if sample_size < 50:
        return max(0.4, confidence - 0.08)
    return confidence


def _stored_unique_count(variable: Variable) -> int | None:
    value = (variable.profile or {}).get("unique_count")
    return int(value) if isinstance(value, int | float) else None


def _validate_stored_metadata(stored: Variable, selected: SelectedVariable) -> None:
    profile = stored.profile or {}
    classification = profile.get("classification")
    if isinstance(classification, dict) and classification.get("role") not in {
        None,
        selected.role.value,
    }:
        raise RecommendationValidationError(
            f"Submitted role for variable {stored.id} conflicts with stored metadata"
        )
    scale_detection = profile.get("scale_detection")
    if isinstance(scale_detection, dict) and scale_detection.get("scale_type") not in {
        None,
        selected.scale_type.value,
    }:
        raise RecommendationValidationError(
            f"Submitted scale for variable {stored.id} conflicts with stored metadata"
        )

