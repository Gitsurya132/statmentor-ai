from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.models.project import Project
from app.db.models.research_question import ResearchQuestion
from app.repositories.base import Repository


class ResearchDesignRepository(Repository[ResearchQuestion]):
    async def project_exists_for_user(self, *, project_id: UUID, user_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                select(Project.id).where(
                    Project.id == project_id,
                    Project.user_id == user_id,
                )
            )
        )

    async def get_for_user(
        self,
        *,
        design_id: UUID,
        user_id: UUID,
    ) -> ResearchQuestion | None:
        return cast(
            ResearchQuestion | None,
            await self.session.scalar(
                select(ResearchQuestion)
                .join(Project, ResearchQuestion.project_id == Project.id)
                .where(
                    ResearchQuestion.id == design_id,
                    Project.user_id == user_id,
                )
            ),
        )

    async def create(self, design: ResearchQuestion) -> ResearchQuestion:
        self.session.add(design)
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        await self.session.refresh(design)
        return design

    async def save(self, design: ResearchQuestion) -> ResearchQuestion:
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        await self.session.refresh(design)
        return design
