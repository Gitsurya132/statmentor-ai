from __future__ import annotations

from typing import cast
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.db.enums import DatasetFormat
from app.db.models.dataset import Dataset, Variable
from app.repositories.dataset import DatasetRepository


class ScalarCollection:
    def __init__(self, values: list[Dataset]) -> None:
        self.values = values

    def all(self) -> list[Dataset]:
        return self.values


@pytest.mark.asyncio
async def test_project_exists_for_user() -> None:
    session = AsyncMock()
    session.scalar.return_value = uuid4()
    repository = DatasetRepository(session)

    exists = await repository.project_exists_for_user(
        project_id=uuid4(),
        user_id=uuid4(),
    )

    assert exists is True
    session.scalar.assert_awaited_once()


@pytest.mark.asyncio
async def test_list_for_project_returns_datasets_and_total() -> None:
    session = AsyncMock()
    dataset = Dataset(
        id=uuid4(),
        project_id=uuid4(),
        name="Study",
        source_format=DatasetFormat.CSV,
    )
    session.scalar.return_value = 1
    session.scalars.return_value = ScalarCollection([dataset])
    repository = DatasetRepository(session)

    datasets, total = await repository.list_for_project(
        project_id=dataset.project_id,
        user_id=uuid4(),
        page=1,
        page_size=20,
    )

    assert datasets == [dataset]
    assert total == 1


@pytest.mark.asyncio
async def test_create_ingested_dataset_commits_graph() -> None:
    session = AsyncMock()
    session.add_all = MagicMock()
    repository = DatasetRepository(session)
    dataset = MagicMock()
    version = MagicMock()
    variables = cast(
        list[Variable],
        [MagicMock(spec=Variable), MagicMock(spec=Variable)],
    )

    await repository.create_ingested_dataset(
        dataset=dataset,
        version=version,
        variables=variables,
    )

    session.add_all.assert_called_once_with([dataset, version, *variables])
    session.commit.assert_awaited_once()
    assert session.refresh.await_count == 4
