from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import ProjectStatus
from app.db.models.common import UpdatedAtMixin
from app.db.types import postgres_enum


class Project(UpdatedAtMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("btrim(title) <> ''", name="projects_title_not_blank"),
        CheckConstraint(
            "jsonb_typeof(research_context) = 'object'",
            name="projects_research_context_object",
        ),
        ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="projects_user_fk", ondelete="CASCADE"
        ),
        UniqueConstraint("id", "user_id", name="projects_id_user_unique"),
        Index("projects_user_created_idx", "user_id", text("created_at DESC")),
        Index("projects_user_status_idx", "user_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    research_context: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    status: Mapped[ProjectStatus] = mapped_column(
        postgres_enum(ProjectStatus, "project_status"),
        nullable=False,
        server_default=text("'active'::project_status"),
    )
