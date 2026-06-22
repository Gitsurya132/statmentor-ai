from __future__ import annotations

from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

ModelType = TypeVar("ModelType")


class Repository[ModelType]:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
