from __future__ import annotations

import asyncio
import json
import platform
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import numpy as np
import pandas as pd
from fastapi import UploadFile
from pydantic import TypeAdapter, ValidationError

from app.db.enums import DatasetFormat, DatasetVersionStatus
from app.db.models.dataset import Dataset, DatasetVersion, Variable
from app.ingestion.exceptions import InvalidDatasetFileError, UnsupportedDatasetFormatError
from app.ingestion.parser import parse_dataset, read_preview
from app.ingestion.storage import LocalDatasetStorage
from app.repositories.dataset import DatasetRepository


@dataclass(frozen=True)
class IngestedDataset:
    dataset: Dataset
    version: DatasetVersion
    variables: list[Variable]


class DatasetService:
    def __init__(
        self,
        *,
        repository: DatasetRepository,
        storage: LocalDatasetStorage,
    ) -> None:
        self.repository = repository
        self.storage = storage

    async def upload(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        upload: UploadFile,
        name: str,
        description: str | None,
        import_options_json: str,
    ) -> IngestedDataset:
        if not await self.repository.project_exists_for_user(
            project_id=project_id,
            user_id=user_id,
        ):
            raise LookupError("Project not found")

        source_format, suffix = _detect_format(upload.filename)
        import_options = _parse_import_options(import_options_json)
        dataset_id = uuid4()
        version_id = uuid4()
        stored = await self.storage.save_original(
            upload=upload,
            project_id=project_id,
            dataset_id=dataset_id,
            version_id=version_id,
            suffix=suffix,
        )
        normalized_path = self.storage.normalized_path(
            project_id=project_id,
            dataset_id=dataset_id,
            version_id=version_id,
        )

        try:
            parsed = await asyncio.to_thread(
                parse_dataset,
                source_path=stored.absolute_path,
                normalized_path=normalized_path,
                source_format=source_format,
                import_options=import_options,
            )
            dataset = Dataset(
                id=dataset_id,
                project_id=project_id,
                name=name.strip(),
                description=description,
                source_format=source_format,
            )
            version = DatasetVersion(
                id=version_id,
                dataset_id=dataset_id,
                project_id=project_id,
                version_number=1,
                status=DatasetVersionStatus.READY,
                original_filename=Path(upload.filename or "upload").name,
                media_type=upload.content_type or _default_media_type(source_format),
                source_storage_key=stored.storage_key,
                normalized_storage_key=self.storage.to_storage_key(parsed.normalized_path),
                file_size_bytes=stored.size_bytes,
                sha256=stored.sha256,
                row_count=parsed.row_count,
                column_count=parsed.column_count,
                import_options=import_options,
                profile_summary=parsed.profile_summary,
                software_versions={
                    "python": platform.python_version(),
                    "pandas": pd.__version__,
                    "numpy": np.__version__,
                },
            )
            variables = [
                Variable(
                    id=uuid4(),
                    dataset_version_id=version_id,
                    source_name=item.source_name,
                    storage_name=item.storage_name,
                    display_name=item.display_name,
                    data_type=item.data_type,
                    measurement_level=item.measurement_level,
                    ordinal_position=item.ordinal_position,
                    value_labels={},
                    missing_rules={},
                    profile=item.profile,
                )
                for item in parsed.variables
            ]
            await self.repository.create_ingested_dataset(
                dataset=dataset,
                version=version,
                variables=variables,
            )
        except Exception:
            self.storage.remove_version_directory(project_id, dataset_id, version_id)
            raise

        return IngestedDataset(dataset=dataset, version=version, variables=variables)

    async def preview(
        self,
        *,
        version: DatasetVersion,
        offset: int,
        limit: int,
    ) -> tuple[list[str], list[dict[str, Any]]]:
        if version.normalized_storage_key is None:
            raise InvalidDatasetFileError("The dataset version has no normalized artifact.")
        normalized_path = self.storage.resolve_key(version.normalized_storage_key)
        return await asyncio.to_thread(
            read_preview,
            normalized_path=normalized_path,
            offset=offset,
            limit=limit,
        )


def _detect_format(filename: str | None) -> tuple[DatasetFormat, str]:
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".csv":
        return DatasetFormat.CSV, suffix
    if suffix in {".xlsx", ".xls"}:
        return DatasetFormat.EXCEL, suffix
    raise UnsupportedDatasetFormatError("Only .csv, .xlsx, and .xls files are supported.")


def _parse_import_options(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw or "{}")
        return TypeAdapter(dict[str, Any]).validate_python(parsed)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise InvalidDatasetFileError("import_options must be a JSON object.") from exc


def _default_media_type(source_format: DatasetFormat) -> str:
    if source_format is DatasetFormat.CSV:
        return "text/csv"
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
