from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import (
    get_dataset_repository,
    get_dataset_service,
    get_development_user_id,
)
from app.db.enums import (
    DatasetFormat,
    DatasetVersionStatus,
    MeasurementLevel,
    VariableDataType,
)
from app.db.models.dataset import Dataset, DatasetVersion, Variable
from app.main import app
from app.services.dataset import IngestedDataset

DEVELOPMENT_USER_ID = UUID("00000000-0000-4000-8000-000000000001")
PROJECT_ID = UUID("00000000-0000-4000-8000-000000000002")


def make_records() -> tuple[Dataset, DatasetVersion, list[Variable]]:
    now = datetime.now(UTC)
    dataset_id = uuid4()
    version_id = uuid4()
    dataset = Dataset(
        id=dataset_id,
        project_id=PROJECT_ID,
        name="Study Data",
        description="Sample",
        source_format=DatasetFormat.CSV,
        created_at=now,
        updated_at=now,
    )
    version = DatasetVersion(
        id=version_id,
        dataset_id=dataset_id,
        project_id=PROJECT_ID,
        version_number=1,
        status=DatasetVersionStatus.READY,
        original_filename="study.csv",
        media_type="text/csv",
        source_storage_key="source.csv",
        normalized_storage_key="normalized.csv",
        file_size_bytes=20,
        sha256="a" * 64,
        row_count=2,
        column_count=2,
        import_options={},
        profile_summary={},
        software_versions={},
        error_code=None,
        error_message=None,
        created_at=now,
    )
    variables = [
        Variable(
            id=uuid4(),
            dataset_version_id=version_id,
            source_name="score",
            storage_name="score",
            display_name="score",
            data_type=VariableDataType.INTEGER,
            measurement_level=MeasurementLevel.SCALE,
            ordinal_position=0,
            value_labels={},
            missing_rules={},
            profile={},
            created_at=now,
            updated_at=now,
        )
    ]
    return dataset, version, variables


class FakeDatasetRepository:
    def __init__(self) -> None:
        self.dataset, self.version, self.variables = make_records()

    async def project_exists_for_user(self, *, project_id: UUID, user_id: UUID) -> bool:
        return project_id == PROJECT_ID and user_id == DEVELOPMENT_USER_ID

    async def list_for_project(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[Dataset], int]:
        return [self.dataset], 1

    async def get_for_user(self, *, dataset_id: UUID, user_id: UUID) -> Dataset | None:
        if dataset_id == self.dataset.id and user_id == DEVELOPMENT_USER_ID:
            return self.dataset
        return None

    async def get_latest_version(self, dataset_id: UUID) -> DatasetVersion | None:
        return self.version if dataset_id == self.dataset.id else None

    async def get_version_for_user(
        self, *, version_id: UUID, user_id: UUID
    ) -> DatasetVersion | None:
        if version_id == self.version.id and user_id == DEVELOPMENT_USER_ID:
            return self.version
        return None

    async def list_variables_for_version(
        self, *, version_id: UUID, user_id: UUID
    ) -> list[Variable] | None:
        if version_id == self.version.id and user_id == DEVELOPMENT_USER_ID:
            return self.variables
        return None


class FakeDatasetService:
    def __init__(self, repository: FakeDatasetRepository) -> None:
        self.repository = repository

    async def upload(self, **_: object) -> IngestedDataset:
        return IngestedDataset(
            dataset=self.repository.dataset,
            version=self.repository.version,
            variables=self.repository.variables,
        )

    async def preview(
        self, *, version: DatasetVersion, offset: int, limit: int
    ) -> tuple[list[str], list[dict[str, object]]]:
        rows: list[dict[str, object]] = [{"score": 10}, {"score": 12}]
        return ["score"], rows[offset : offset + limit]


@pytest.fixture
def repository() -> FakeDatasetRepository:
    return FakeDatasetRepository()


@pytest.fixture
def client(repository: FakeDatasetRepository) -> Generator[TestClient]:
    service = FakeDatasetService(repository)
    app.dependency_overrides[get_dataset_repository] = lambda: repository
    app.dependency_overrides[get_dataset_service] = lambda: service
    app.dependency_overrides[get_development_user_id] = lambda: DEVELOPMENT_USER_ID
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_upload_csv(client: TestClient, repository: FakeDatasetRepository) -> None:
    response = client.post(
        f"/api/v1/projects/{PROJECT_ID}/datasets",
        data={"name": "Study Data", "import_options": "{}"},
        files={"file": ("study.csv", b"score,group\n10,A\n12,B\n", "text/csv")},
    )

    assert response.status_code == 201
    assert response.json()["id"] == str(repository.dataset.id)
    assert response.json()["latest_version"]["row_count"] == 2


def test_list_datasets(client: TestClient) -> None:
    response = client.get(f"/api/v1/projects/{PROJECT_ID}/datasets")

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_get_dataset(client: TestClient, repository: FakeDatasetRepository) -> None:
    response = client.get(f"/api/v1/datasets/{repository.dataset.id}")

    assert response.status_code == 200
    assert response.json()["latest_version"]["id"] == str(repository.version.id)


def test_get_dataset_version(client: TestClient, repository: FakeDatasetRepository) -> None:
    response = client.get(f"/api/v1/dataset-versions/{repository.version.id}")

    assert response.status_code == 200
    assert response.json()["row_count"] == 2


def test_list_variables(client: TestClient, repository: FakeDatasetRepository) -> None:
    response = client.get(f"/api/v1/dataset-versions/{repository.version.id}/variables")

    assert response.status_code == 200
    assert response.json()[0]["storage_name"] == "score"


def test_preview(client: TestClient, repository: FakeDatasetRepository) -> None:
    response = client.get(
        f"/api/v1/dataset-versions/{repository.version.id}/preview?offset=0&limit=2"
    )

    assert response.status_code == 200
    assert response.json()["columns"] == ["score"]
    assert len(response.json()["rows"]) == 2
