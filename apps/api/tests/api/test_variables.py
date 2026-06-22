from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_dataset_repository, get_development_user_id
from app.db.enums import MeasurementLevel, VariableDataType
from app.db.models.dataset import Variable
from app.main import app

DEVELOPMENT_USER_ID = UUID("00000000-0000-4000-8000-000000000001")


def make_variable() -> Variable:
    now = datetime.now(UTC)
    return Variable(
        id=uuid4(),
        dataset_version_id=uuid4(),
        source_name="Employee Performance Outcome",
        storage_name="employee_performance_outcome",
        display_name="Employee Performance Outcome",
        data_type=VariableDataType.FLOAT,
        measurement_level=MeasurementLevel.SCALE,
        ordinal_position=0,
        value_labels={},
        missing_rules={},
        profile={"minimum": 0, "unique_count": 20},
        created_at=now,
        updated_at=now,
    )


class FakeVariableRepository:
    def __init__(self) -> None:
        self.variable = make_variable()

    async def get_variable_for_user(
        self, *, variable_id: UUID, user_id: UUID
    ) -> Variable | None:
        if variable_id == self.variable.id and user_id == DEVELOPMENT_USER_ID:
            return self.variable
        return None

    async def list_variables_for_version(
        self, *, version_id: UUID, user_id: UUID
    ) -> list[Variable] | None:
        if version_id == self.variable.dataset_version_id and user_id == DEVELOPMENT_USER_ID:
            return [self.variable]
        return None

    async def save_variable(self, variable: Variable) -> Variable:
        return variable

    async def save_variables(self, variables: list[Variable]) -> list[Variable]:
        return variables


@pytest.fixture
def repository() -> FakeVariableRepository:
    return FakeVariableRepository()


@pytest.fixture
def client(repository: FakeVariableRepository) -> Generator[TestClient]:
    app.dependency_overrides[get_dataset_repository] = lambda: repository
    app.dependency_overrides[get_development_user_id] = lambda: DEVELOPMENT_USER_ID
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_detect_variable_metadata(
    client: TestClient, repository: FakeVariableRepository
) -> None:
    response = client.post(
        "/api/v1/dataset-versions/"
        f"{repository.variable.dataset_version_id}/classifications/detect"
    )

    assert response.status_code == 200
    variable = response.json()["variables"][0]
    assert variable["classification"]["role"] == "dependent_variable"
    assert variable["scale_detection"]["scale_type"] == "ratio"


def test_update_variable_metadata(
    client: TestClient, repository: FakeVariableRepository
) -> None:
    response = client.patch(
        f"/api/v1/variables/{repository.variable.id}/metadata",
        json={
            "role": "moderator",
            "role_confidence": 0.95,
            "role_explanation": "Specified as an interaction variable.",
            "scale_type": "interval",
            "scale_confidence": 0.9,
            "scale_explanation": "Equal intervals with no meaningful zero.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["classification"]["role"] == "moderator"
    assert body["classification"]["source"] == "manual"
    assert body["scale_detection"]["scale_type"] == "interval"
    assert body["measurement_level"] == "scale"


def test_get_variable_metadata(
    client: TestClient, repository: FakeVariableRepository
) -> None:
    response = client.get(f"/api/v1/variables/{repository.variable.id}/metadata")

    assert response.status_code == 200
    assert response.json()["id"] == str(repository.variable.id)
