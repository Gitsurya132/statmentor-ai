from __future__ import annotations

from uuid import UUID

from app.db.models.research_question import ResearchQuestion
from app.repositories.research_design import ResearchDesignRepository
from app.schemas.research_question import (
    ResearchDesignCreate,
    ResearchDesignRead,
    ResearchDesignUpdate,
    StudyFocus,
)


class ResearchDesignService:
    def __init__(self, repository: ResearchDesignRepository) -> None:
        self.repository = repository

    async def create(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        data: ResearchDesignCreate,
    ) -> ResearchQuestion:
        if not await self.repository.project_exists_for_user(
            project_id=project_id,
            user_id=user_id,
        ):
            raise LookupError("Project not found")
        context = data.model_dump(mode="json")
        design = ResearchQuestion(
            project_id=project_id,
            question_text=data.research_questions[0],
            study_design=f"{data.temporal_design.value}_{data.study_type.value}",
            structured_context=context,
        )
        return await self.repository.create(design)

    async def update(
        self,
        *,
        design: ResearchQuestion,
        data: ResearchDesignUpdate,
    ) -> ResearchQuestion:
        context = dict(design.structured_context)
        context.update(data.model_dump(exclude_unset=True, mode="json"))
        validated = ResearchDesignCreate.model_validate(context)
        design.question_text = validated.research_questions[0]
        design.study_design = f"{validated.temporal_design.value}_{validated.study_type.value}"
        design.structured_context = validated.model_dump(mode="json")
        return await self.repository.save(design)


def research_design_response(design: ResearchQuestion) -> ResearchDesignRead:
    data = ResearchDesignCreate.model_validate(design.structured_context)
    return ResearchDesignRead(
        id=design.id,
        project_id=design.project_id,
        **data.model_dump(),
        summary=generate_research_design_summary(data),
        created_at=design.created_at,
        updated_at=design.updated_at,
    )


def generate_research_design_summary(data: ResearchDesignCreate) -> str:
    temporal = data.temporal_design.value.replace("_", "-")
    study_type = data.study_type.value.replace("_", "-")
    focus = {
        StudyFocus.RELATIONSHIP: "examining the relationship between",
        StudyFocus.COMPARISON: "comparing",
        StudyFocus.BOTH: "comparing groups and examining relationships among",
    }[data.study_focus]
    constructs = _join_naturally(data.key_constructs)
    if not constructs:
        constructs = "the variables identified in your research questions"
    return f"You are conducting a {temporal} {study_type} study {focus} {constructs}."


def _join_naturally(values: list[str]) -> str:
    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    if len(values) == 2:
        return f"{values[0]} and {values[1]}"
    return f"{', '.join(values[:-1])}, and {values[-1]}"
