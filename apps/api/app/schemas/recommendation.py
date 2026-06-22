from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.classification.engine import ScaleType, VariableRole
from app.db.enums import AnalysisMethod


class MethodMetadata(BaseModel):
    method_key: AnalysisMethod
    method_name: str
    description: str
    required_variables: list[str]
    assumptions: list[str]
    sample_size_guidance: str
    advantages: list[str]
    limitations: list[str]
    alternatives: list[AnalysisMethod]


class SelectedVariable(BaseModel):
    variable_id: UUID
    role: VariableRole
    scale_type: ScaleType


class TestRecommendationRequest(BaseModel):
    research_design_id: UUID
    dataset_version_id: UUID
    variables: list[SelectedVariable] = Field(min_length=1)

    @model_validator(mode="after")
    def variable_ids_must_be_unique(self) -> TestRecommendationRequest:
        identifiers = [variable.variable_id for variable in self.variables]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("selected variable IDs must be unique")
        return self


class TestRecommendation(BaseModel):
    method_key: AnalysisMethod
    method_name: str
    why_recommended: str
    required_variables: list[str]
    assumptions: list[str]
    sample_size_guidance: str
    advantages: list[str]
    limitations: list[str]
    alternatives: list[AnalysisMethod]
    confidence_score: float = Field(ge=0, le=1)


class TestRecommendationResponse(BaseModel):
    project_id: UUID
    research_design_id: UUID
    dataset_version_id: UUID
    recommendations: list[TestRecommendation]
    advisory_note: str

