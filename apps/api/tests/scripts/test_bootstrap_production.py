from pathlib import Path

from app.scripts.bootstrap_production import asyncpg_database_url, migration_path


def test_asyncpg_database_url_removes_sqlalchemy_driver() -> None:
    value = "postgresql+asyncpg://user:secret@database.internal/statmentor"

    assert (
        asyncpg_database_url(value)
        == "postgresql://user:secret@database.internal/statmentor"
    )


def test_migration_path_finds_repository_migration() -> None:
    path = migration_path()

    assert isinstance(path, Path)
    assert path.name == "0001_mvp_schema.up.sql"
    assert path.is_file()
