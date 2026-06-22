from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.enums import ProjectStatus
from app.db.models.project import Project
from app.repositories.base import Repository
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectRepository(Repository[Project]):
    async def list_for_user(
        self,
        *,
        user_id: UUID,
        page: int,
        page_size: int,
        status: ProjectStatus | None = None,
    ) -> tuple[list[Project], int]:
        filters = [Project.user_id == user_id]
        if status is not None:
            filters.append(Project.status == status)

        total = await self.session.scalar(select(func.count()).select_from(Project).where(*filters))
        projects = list(
            (
                await self.session.scalars(
                    select(Project)
                    .where(*filters)
                    .order_by(Project.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return projects, int(total or 0)

    async def get_for_user(self, *, project_id: UUID, user_id: UUID) -> Project | None:
        return cast(
            Project | None,
            await self.session.scalar(
                select(Project).where(
                    Project.id == project_id,
                    Project.user_id == user_id,
                )
            ),
        )

    async def create(self, *, user_id: UUID, data: ProjectCreate) -> Project:
        project = Project(
            user_id=user_id,
            title=data.title,
            description=data.description,
            research_context=data.research_context,
        )
        self.session.add(project)
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        await self.session.refresh(project)
        return project

    async def update(self, *, project: Project, data: ProjectUpdate) -> Project:
        changes = data.model_dump(exclude_unset=True)
        for field, value in changes.items():
            setattr(project, field, value)

        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        await self.session.refresh(project)
        return project

    async def delete(self, *, project: Project) -> None:
        await self.session.delete(project)
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
