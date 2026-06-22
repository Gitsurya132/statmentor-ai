from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.db.enums import ProjectStatus
from app.schemas.base import ORMModel


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    description: str | None = None
    research_context: dict[str, Any] = Field(default_factory=dict)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = None
    research_context: dict[str, Any] | None = None
    status: ProjectStatus | None = None

    @model_validator(mode="before")
    @classmethod
    def required_fields_cannot_be_null(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for field in ("title", "research_context", "status"):
                if field in data and data[field] is None:
                    raise ValueError(f"{field} cannot be null")
        return data

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value


class ProjectRead(ORMModel):
    id: UUID
    user_id: UUID
    title: str
    description: str | None
    research_context: dict[str, Any]
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    items: list[ProjectRead]
    page: int
    page_size: int
    total: int
