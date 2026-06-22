from __future__ import annotations

from enum import StrEnum

from sqlalchemy.dialects.postgresql import ENUM


def postgres_enum[EnumType: StrEnum](
    enum_class: type[EnumType],
    name: str,
) -> ENUM:
    return ENUM(
        enum_class,
        name=name,
        values_callable=lambda members: [member.value for member in members],
        create_type=False,
    )
