from __future__ import annotations

import hashlib
import shutil
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile

from app.ingestion.exceptions import DatasetTooLargeError, InvalidDatasetFileError


@dataclass(frozen=True)
class StoredUpload:
    storage_key: str
    absolute_path: Path
    size_bytes: int
    sha256: str


class LocalDatasetStorage:
    def __init__(self, root: Path, max_upload_size_bytes: int) -> None:
        self.root = root.resolve()
        self.max_upload_size_bytes = max_upload_size_bytes

    async def save_original(
        self,
        *,
        upload: UploadFile,
        project_id: UUID,
        dataset_id: UUID,
        version_id: UUID,
        suffix: str,
    ) -> StoredUpload:
        directory = self.root / str(project_id) / str(dataset_id) / str(version_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"original{suffix}"
        digest = hashlib.sha256()
        size = 0

        try:
            with path.open("wb") as destination:
                while chunk := await upload.read(1024 * 1024):
                    size += len(chunk)
                    if size > self.max_upload_size_bytes:
                        raise DatasetTooLargeError(
                            f"Upload exceeds {self.max_upload_size_bytes} bytes."
                        )
                    digest.update(chunk)
                    destination.write(chunk)
        except Exception:
            self.remove_version_directory(project_id, dataset_id, version_id)
            raise
        finally:
            await upload.close()

        if size == 0:
            self.remove_version_directory(project_id, dataset_id, version_id)
            raise InvalidDatasetFileError("The uploaded file is empty.")

        return StoredUpload(
            storage_key=self.to_storage_key(path),
            absolute_path=path,
            size_bytes=size,
            sha256=digest.hexdigest(),
        )

    def normalized_path(
        self,
        *,
        project_id: UUID,
        dataset_id: UUID,
        version_id: UUID,
    ) -> Path:
        return self.root / str(project_id) / str(dataset_id) / str(version_id) / "normalized.csv"

    def resolve_key(self, storage_key: str) -> Path:
        candidate = (self.root / storage_key).resolve()
        if candidate != self.root and self.root not in candidate.parents:
            raise InvalidDatasetFileError("Invalid local storage key.")
        return candidate

    def to_storage_key(self, path: Path) -> str:
        return path.resolve().relative_to(self.root).as_posix()

    def remove_version_directory(
        self,
        project_id: UUID,
        dataset_id: UUID,
        version_id: UUID,
    ) -> None:
        directory = self.root / str(project_id) / str(dataset_id) / str(version_id)
        shutil.rmtree(directory, ignore_errors=True)
