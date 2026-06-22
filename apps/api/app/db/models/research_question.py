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
from app.db.models.common import UpdatedAtMixin


class ResearchQuestion(UpdatedAtMixin, Base):
    __tablename__ = "research_questions"
    __table_args__ = (
        CheckConstraint("btrim(question_text) <> ''", name="research_questions_text_not_blank"),
        CheckConstraint(
            "jsonb_typeof(structured_context) = 'object'",
            name="research_questions_context_object",
        ),
        ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name="research_questions_project_fk",
            ondelete="CASCADE",
        ),
        UniqueConstraint("id", "project_id", name="research_questions_id_project_unique"),
        Index("research_questions_project_created_idx", "project_id", text("created_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    study_design: Mapped[str | None] = mapped_column(String(100))
    structured_context: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
