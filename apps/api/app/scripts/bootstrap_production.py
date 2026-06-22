from __future__ import annotations

import asyncio
from pathlib import Path

import asyncpg  # type: ignore[import-untyped]

from app.core.config import get_settings
from app.scripts.seed_development import seed_development_data


def asyncpg_database_url(database_url: str) -> str:
    """Convert SQLAlchemy's async URL into a DSN accepted by asyncpg."""
    return database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


def migration_path() -> Path:
    """Locate the repository migration from local and Render working directories."""
    candidates = (
        Path.cwd() / "../../database/migrations/0001_mvp_schema.up.sql",
        Path.cwd() / "database/migrations/0001_mvp_schema.up.sql",
        Path(__file__).resolve().parents[4]
        / "database/migrations/0001_mvp_schema.up.sql",
    )
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved.is_file():
            return resolved
    searched = ", ".join(str(candidate.resolve()) for candidate in candidates)
    raise FileNotFoundError(f"Could not locate the MVP migration. Searched: {searched}")


async def schema_exists(connection: asyncpg.Connection) -> bool:
    return bool(
        await connection.fetchval(
            "SELECT to_regclass('public.users') IS NOT NULL"
        )
    )


async def bootstrap_production() -> None:
    settings = get_settings()
    connection = await asyncpg.connect(
        asyncpg_database_url(settings.database_url),
        timeout=30,
    )
    try:
        if await schema_exists(connection):
            print("Database schema already exists; migration skipped.")
        else:
            path = migration_path()
            print(f"Applying database migration: {path}")
            await connection.execute(path.read_text(encoding="utf-8"))
            print("Database migration applied successfully.")
    finally:
        await connection.close()

    await seed_development_data()
    print("Production bootstrap completed successfully.")


def main() -> None:
    asyncio.run(bootstrap_production())


if __name__ == "__main__":
    main()
