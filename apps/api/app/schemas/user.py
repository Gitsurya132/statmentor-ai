from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr

from app.db.enums import UserStatus
from app.schemas.base import ORMModel


class UserRead(ORMModel):
    id: UUID
    email: EmailStr
    name: str
    image_url: str | None
    email_verified_at: datetime | None
    status: UserStatus
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
