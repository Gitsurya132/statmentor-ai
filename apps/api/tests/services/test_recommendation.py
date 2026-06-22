from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.classification.engine import ScaleType, VariableRole
from app.db.enums import (
    AnalysisMethod,
    DatasetVersionStatus,
    MeasurementLevel,
    VariableDataType,
)
from app.db.models.dataset import DatasetVersion, Variable
from app.db.models.research_question import ResearchQuestion
from app.schemas.recommendation import SelectedVariable
from app.schemas.recommendation import TestRecommendationRequest as RecommendationRequest
from app.schemas.research_question import ResearchDesignCreate
from app.services.recommendation import RecommendationService

PROJECT_ID = uuid4()
USER_ID = uuid4()
VERSION_ID = uuid4()
DESIGN_ID = uuid4()


def make_variable(
    *,
    role: VariableRole,
    scale: ScaleType,
    unique_count: int,
) -> Variable:
    now = datetime.now(UTC)
    data_type = (
        VariableDataType.STRING
        if scale is ScaleType.NOMINAL
        else VariableDataType.FLOAT
    )
    measurement = (
        MeasurementLevel.NOMINAL
        if scale is ScaleType.NOMINAL
        else MeasurementLevel.SCALE
    )
    return Variable(
        id=uuid4(),
        dataset_version_id=VERSION_ID,
        source_name=role.value,
        storage_name=role.value,
        display_name=role.value,
        data_type=data_type,
        measurement_level=measurement,
        ordinal_position=0,
        value_labels={},
        missing_rules={},
        profile={
            "unique_count": unique_count,
            "classification": {"role": role.value},
            "scale_detection": {"scale_type": scale.value},
        },
        created_at=now,
        updated_at=now,
    )


class FakeDatasetRepository:
    def __init__(self, variables: list[Variable]) -> None:
        self.variables = variables
        self.version = DatasetVersion(
            id=VERSION_ID,
            dataset_id=uuid4(),
            project_id=PROJECT_ID,
            version_number=1,
            status=DatasetVersionStatus.READY,
            original_filename="data.csv",
            media_type="text/csv",
            source_storage_key="source.csv",
            normalized_storage_key="normalized.csv",
            file_size_bytes=10,
            sha256="a" * 64,
            row_count=200,
            column_count=len(variables),
            import_options={},
            profile_summary={},
            software_versions={},
            error_code=None,
            error_message=None,
            created_at=datetime.now(UTC),
        )

    async def get_version_for_user(
        self, *, version_id: UUID, user_id: UUID
    ) -> DatasetVersion | None:
        return self.version if version_id == VERSION_ID and user_id == USER_ID else None

    async def list_variables_for_version(
        self, *, version_id: UUID, user_id: UUID
    ) -> list[Variable] | None:
        return self.variables if version_id == VERSION_ID and user_id == USER_ID else None


class FakeResearchDesignRepository:
    def __init__(self, design_data: ResearchDesignCreate) -> None:
        now = datetime.now(UTC)
        self.design = ResearchQuestion(
            id=DESIGN_ID,
            project_id=PROJECT_ID,
            question_text=design_data.research_questions[0],
            study_design="cross_sectional_quantitative",
            structured_context=design_data.model_dump(mode="json"),
            created_at=now,
            updated_at=now,
        )

    async def get_for_user(
        self, *, design_id: UUID, user_id: UUID
    ) -> ResearchQuestion | None:
        return self.design if design_id == DESIGN_ID and user_id == USER_ID else None


def selected(variables: list[Variable]) -> list[SelectedVariable]:
    return [
        SelectedVariable(
            variable_id=variable.id,
            role=VariableRole(variable.profile["classification"]["role"]),
            scale_type=ScaleType(variable.profile["scale_detection"]["scale_type"]),
        )
        for variable in variables
    ]


@pytest.mark.asyncio
async def test_relationship_design_recommends_regression_and_correlation() -> None:
    independent = make_variable(
        role=VariableRole.INDEPENDENT_VARIABLE,
        scale=ScaleType.RATIO,
        unique_count=100,
    )
    dependent = make_variable(
        role=VariableRole.DEPENDENT_VARIABLE,
        scale=ScaleType.INTERVAL,
        unique_count=90,
    )
    design = ResearchDesignCreate(
        study_type="quantitative",
        research_questions=["How are leadership and performance related?"],
        hypotheses=[],
        sample_size=200,
        temporal_design="cross_sectional",
        study_focus="relationship",
        software_preference="Python",
        key_constructs=["leadership", "performance"],
    )
    service = RecommendationService(
        dataset_repository=FakeDatasetRepository([independent, dependent]),  # type: ignore[arg-type]
        research_design_repository=FakeResearchDesignRepository(design),  # type: ignore[arg-type]
    )

    response = await service.recommend(
        project_id=PROJECT_ID,
        user_id=USER_ID,
        request=RecommendationRequest(
            research_design_id=DESIGN_ID,
            dataset_version_id=VERSION_ID,
            variables=selected([independent, dependent]),
        ),
    )

    methods = {item.method_key for item in response.recommendations}
    assert AnalysisMethod.LINEAR_REGRESSION in methods
    assert AnalysisMethod.PEARSON_CORRELATION in methods
    assert AnalysisMethod.DESCRIPTIVE_STATISTICS in methods


@pytest.mark.asyncio
async def test_two_group_comparison_recommends_t_test() -> None:
    group = make_variable(
        role=VariableRole.INDEPENDENT_VARIABLE,
        scale=ScaleType.NOMINAL,
        unique_count=2,
    )
    outcome = make_variable(
        role=VariableRole.DEPENDENT_VARIABLE,
        scale=ScaleType.RATIO,
        unique_count=80,
    )
    design = ResearchDesignCreate(
        study_type="quantitative",
        research_questions=["Do the two groups differ?"],
        hypotheses=[],
        sample_size=100,
        temporal_design="cross_sectional",
        study_focus="comparison",
        software_preference="Python",
        key_constructs=["group", "outcome"],
    )
    service = RecommendationService(
        dataset_repository=FakeDatasetRepository([group, outcome]),  # type: ignore[arg-type]
        research_design_repository=FakeResearchDesignRepository(design),  # type: ignore[arg-type]
    )

    response = await service.recommend(
        project_id=PROJECT_ID,
        user_id=USER_ID,
        request=RecommendationRequest(
            research_design_id=DESIGN_ID,
            dataset_version_id=VERSION_ID,
            variables=selected([group, outcome]),
        ),
    )

    assert AnalysisMethod.INDEPENDENT_T_TEST in {
        item.method_key for item in response.recommendations
    }
