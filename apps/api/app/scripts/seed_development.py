from __future__ import annotations

import asyncio

from sqlalchemy.dialects.postgresql import insert

from app.core.config import get_settings
from app.db.enums import ProjectStatus, UserStatus
from app.db.models.project import Project
from app.db.models.user import User
from app.db.session import AsyncSessionFactory, engine


async def seed_development_data() -> None:
    settings = get_settings()

    async with AsyncSessionFactory() as session:
        user_result = await session.execute(
            insert(User)
            .values(
                id=settings.development_user_id,
                email=settings.development_user_email,
                name=settings.development_user_name,
                google_subject="development-test-user",
                email_verified_at=None,
                status=UserStatus.ACTIVE,
            )
            .on_conflict_do_update(
                index_elements=[User.email],
                set_={
                    "name": settings.development_user_name,
                    "google_subject": "development-test-user",
                    "status": UserStatus.ACTIVE,
                },
            )
            .returning(User.id)
        )
        user_id = user_result.scalar_one()

        await session.execute(
            insert(Project)
            .values(
                id=settings.development_project_id,
                user_id=user_id,
                title=settings.development_project_title,
                description="Seeded project for local API development.",
                research_context={"seeded": True},
                status=ProjectStatus.ACTIVE,
            )
            .on_conflict_do_update(
                index_elements=[Project.id],
                set_={
                    "user_id": user_id,
                    "title": settings.development_project_title,
                    "description": "Seeded project for local API development.",
                    "research_context": {"seeded": True},
                    "status": ProjectStatus.ACTIVE,
                },
            )
        )
        await session.commit()

    await engine.dispose()
    print(f"Seeded development user {user_id} and project {settings.development_project_id}.")


def main() -> None:
    asyncio.run(seed_development_data())


if __name__ == "__main__":
    main()
