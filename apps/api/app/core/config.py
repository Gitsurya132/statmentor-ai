from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from uuid import UUID

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="STATMENTOR_",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "StatMentor AI API"
    app_version: str = "0.1.0"
    environment: str = "local"
    debug: bool = False
    docs_enabled: bool = True
    api_v1_prefix: str = "/api/v1"

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/statmentor"
    )
    database_echo: bool = False
    database_pool_size: int = Field(default=5, ge=1)
    database_max_overflow: int = Field(default=10, ge=0)
    database_pool_timeout_seconds: int = Field(default=30, ge=1)

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ]
    )

    development_user_id: UUID = UUID("00000000-0000-4000-8000-000000000001")
    development_user_email: str = "developer@statmentor.local"
    development_user_name: str = "StatMentor Developer"
    development_project_id: UUID = UUID("00000000-0000-4000-8000-000000000002")
    development_project_title: str = "Sample Dissertation Project"

    upload_root: Path = Path("./storage/uploads")
    max_upload_size_bytes: int = Field(default=25 * 1024 * 1024, gt=0)
    dataset_preview_max_rows: int = Field(default=100, ge=1, le=1000)

    @field_validator("database_url")
    @classmethod
    def validate_async_postgresql_url(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("database_url must use the postgresql+asyncpg driver")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
