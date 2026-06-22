from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import UploadFile

from app.ingestion.exceptions import DatasetTooLargeError
from app.ingestion.storage import LocalDatasetStorage


@pytest.mark.asyncio
async def test_save_original_persists_bytes_and_checksum(tmp_path: Path) -> None:
    storage = LocalDatasetStorage(tmp_path, max_upload_size_bytes=1024)
    project_id = uuid4()
    dataset_id = uuid4()
    version_id = uuid4()

    stored = await storage.save_original(
        upload=UploadFile(filename="study.csv", file=BytesIO(b"score\n10\n")),
        project_id=project_id,
        dataset_id=dataset_id,
        version_id=version_id,
        suffix=".csv",
    )

    assert stored.absolute_path.read_bytes() == b"score\n10\n"
    assert stored.size_bytes == 9
    assert storage.resolve_key(stored.storage_key) == stored.absolute_path


@pytest.mark.asyncio
async def test_save_original_rejects_oversized_upload_and_cleans_up(tmp_path: Path) -> None:
    storage = LocalDatasetStorage(tmp_path, max_upload_size_bytes=3)
    project_id = uuid4()
    dataset_id = uuid4()
    version_id = uuid4()

    with pytest.raises(DatasetTooLargeError):
        await storage.save_original(
            upload=UploadFile(filename="study.csv", file=BytesIO(b"1234")),
            project_id=project_id,
            dataset_id=dataset_id,
            version_id=version_id,
            suffix=".csv",
        )

    directory = tmp_path / str(project_id) / str(dataset_id) / str(version_id)
    assert not directory.exists()
