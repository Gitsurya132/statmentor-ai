from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, String, Text, text
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import UserStatus
from app.db.models.common import UpdatedAtMixin
from app.db.types import postgres_enum


class User(UpdatedAtMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("btrim(name) <> ''", name="users_name_not_blank"),
        CheckConstraint(
            "password_hash IS NOT NULL OR google_subject IS NOT NULL",
            name="users_auth_method_required",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(CITEXT(), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text)
    password_hash: Mapped[str | None] = mapped_column(Text)
    google_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[UserStatus] = mapped_column(
        postgres_enum(UserStatus, "user_status"),
        nullable=False,
        server_default=text("'active'::user_status"),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
