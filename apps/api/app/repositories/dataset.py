from __future__ import annotations

from typing import cast
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.db.models.dataset import Dataset, DatasetVersion, Variable
from app.db.models.project import Project
from app.repositories.base import Repository


class DatasetRepository(Repository[Dataset]):
    async def project_exists_for_user(self, *, project_id: UUID, user_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                select(Project.id).where(
                    Project.id == project_id,
                    Project.user_id == user_id,
                )
            )
        )

    async def list_for_project(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[Dataset], int]:
        ownership = (
            Dataset.project_id == Project.id,
            Project.id == project_id,
            Project.user_id == user_id,
        )
        total = await self.session.scalar(
            select(func.count())
            .select_from(Dataset)
            .join(Project, Dataset.project_id == Project.id)
            .where(*ownership[1:])
        )
        datasets = list(
            (
                await self.session.scalars(
                    select(Dataset)
                    .join(Project, Dataset.project_id == Project.id)
                    .where(*ownership[1:])
                    .order_by(Dataset.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            ).all()
        )
        return datasets, int(total or 0)

    async def get_for_user(self, *, dataset_id: UUID, user_id: UUID) -> Dataset | None:
        return cast(
            Dataset | None,
            await self.session.scalar(
                select(Dataset)
                .join(Project, Dataset.project_id == Project.id)
                .where(Dataset.id == dataset_id, Project.user_id == user_id)
            ),
        )

    async def get_latest_version(self, dataset_id: UUID) -> DatasetVersion | None:
        return cast(
            DatasetVersion | None,
            await self.session.scalar(
                select(DatasetVersion)
                .where(DatasetVersion.dataset_id == dataset_id)
                .order_by(DatasetVersion.version_number.desc())
                .limit(1)
            ),
        )

    async def get_version_for_user(
        self,
        *,
        version_id: UUID,
        user_id: UUID,
    ) -> DatasetVersion | None:
        return cast(
            DatasetVersion | None,
            await self.session.scalar(
                select(DatasetVersion)
                .join(Project, DatasetVersion.project_id == Project.id)
                .where(DatasetVersion.id == version_id, Project.user_id == user_id)
            ),
        )

    async def list_variables_for_version(
        self,
        *,
        version_id: UUID,
        user_id: UUID,
    ) -> list[Variable] | None:
        version = await self.get_version_for_user(version_id=version_id, user_id=user_id)
        if version is None:
            return None
        return list(
            (
                await self.session.scalars(
                    select(Variable)
                    .where(Variable.dataset_version_id == version_id)
                    .order_by(Variable.ordinal_position)
                )
            ).all()
        )

    async def get_variable_for_user(
        self,
        *,
        variable_id: UUID,
        user_id: UUID,
    ) -> Variable | None:
        return cast(
            Variable | None,
            await self.session.scalar(
                select(Variable)
                .join(
                    DatasetVersion,
                    Variable.dataset_version_id == DatasetVersion.id,
                )
                .join(Project, DatasetVersion.project_id == Project.id)
                .where(Variable.id == variable_id, Project.user_id == user_id)
            ),
        )

    async def save_variable(self, variable: Variable) -> Variable:
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        await self.session.refresh(variable)
        return variable

    async def save_variables(self, variables: list[Variable]) -> list[Variable]:
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        for variable in variables:
            await self.session.refresh(variable)
        return variables

    async def create_ingested_dataset(
        self,
        *,
        dataset: Dataset,
        version: DatasetVersion,
        variables: list[Variable],
    ) -> None:
        self.session.add_all([dataset, version, *variables])
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise
        await self.session.refresh(dataset)
        await self.session.refresh(version)
        for variable in variables:
            await self.session.refresh(variable)
