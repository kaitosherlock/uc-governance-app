"""Narrow SQL templates for documented direct table controls.

Only identifiers enter these templates.  They are parsed as qualified UC names and
backtick-quoted one segment at a time; values are never interpolated into policy DDL.
"""

from app.domain.names import parts
from app.errors import ValidationFailed


def identifier(value: str, *, qualified: bool = False) -> str:
    segments = parts(value)
    if not qualified and len(segments) != 1:
        raise ValidationFailed("A column name must be a single identifier.")
    return ".".join(f"`{segment.replace('`', '``')}`" for segment in segments)


def set_row_filter(table: str, function: str, columns: tuple[str, ...]) -> str:
    rendered = ", ".join(identifier(column) for column in columns)
    return (
        f"ALTER TABLE {identifier(table, qualified=True)} SET ROW FILTER "
        f"{identifier(function, qualified=True)} ON ({rendered})"
    )


def drop_row_filter(table: str) -> str:
    return f"ALTER TABLE {identifier(table, qualified=True)} DROP ROW FILTER"


def set_column_mask(table: str, column: str, function: str, using_columns: tuple[str, ...]) -> str:
    using = (
        ""
        if not using_columns
        else " USING COLUMNS (" + ", ".join(identifier(item) for item in using_columns) + ")"
    )
    return (
        f"ALTER TABLE {identifier(table, qualified=True)} ALTER COLUMN {identifier(column)} "
        f"SET MASK {identifier(function, qualified=True)}{using}"
    )


def drop_column_mask(table: str, column: str) -> str:
    return (
        f"ALTER TABLE {identifier(table, qualified=True)} ALTER COLUMN {identifier(column)} "
        "DROP MASK"
    )
