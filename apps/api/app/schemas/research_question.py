from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import ORMModel


class ResearchQuestionRead(ORMModel):
    id: UUID
    project_id: UUID
    question_text: str
    study_design: str | None
    structured_context: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class StudyType(StrEnum):
    QUANTITATIVE = "quantitative"
    QUALITATIVE = "qualitative"
    MIXED_METHODS = "mixed_methods"


class TemporalDesign(StrEnum):
    CROSS_SECTIONAL = "cross_sectional"
    LONGITUDINAL = "longitudinal"


class StudyFocus(StrEnum):
    COMPARISON = "comparison"
    RELATIONSHIP = "relationship"
    BOTH = "both"


class ResearchDesignCreate(BaseModel):
    study_type: StudyType
    research_questions: list[str] = Field(min_length=1)
    hypotheses: list[str] = Field(default_factory=list)
    sample_size: int | None = Field(default=None, ge=1)
    temporal_design: TemporalDesign
    study_focus: StudyFocus
    software_preference: str = Field(min_length=1, max_length=100)
    key_constructs: list[str] = Field(default_factory=list)

    @field_validator(
        "research_questions",
        "hypotheses",
        "key_constructs",
    )
    @classmethod
    def strip_list_values(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values if value.strip()]
        if not cleaned and values:
            raise ValueError("list values must not be blank")
        return cleaned

    @field_validator("software_preference")
    @classmethod
    def strip_software_preference(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("software_preference must not be blank")
        return value


class ResearchDesignUpdate(BaseModel):
    study_type: StudyType | None = None
    research_questions: list[str] | None = Field(default=None, min_length=1)
    hypotheses: list[str] | None = None
    sample_size: int | None = Field(default=None, ge=1)
    temporal_design: TemporalDesign | None = None
    study_focus: StudyFocus | None = None
    software_preference: str | None = Field(default=None, min_length=1, max_length=100)
    key_constructs: list[str] | None = None


class ResearchDesignRead(BaseModel):
    id: UUID
    project_id: UUID
    study_type: StudyType
    research_questions: list[str]
    hypotheses: list[str]
    sample_size: int | None
    temporal_design: TemporalDesign
    study_focus: StudyFocus
    software_preference: str
    key_constructs: list[str]
    summary: str
    created_at: datetime
    updated_at: datetime


class ResearchDesignSummary(BaseModel):
    design_id: UUID
    summary: str
