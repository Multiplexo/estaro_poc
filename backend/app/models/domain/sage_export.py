from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class ExportColumn(BaseModel):
    title: str
    source: str = Field(
        description=(
            "Dotted path in the inquiry data (e.g. 'kundeninformationen.kunde'), "
            "'position.<field>' for position values, 'position.index' for the "
            "1-based position number, or 'literal:<value>' for a fixed value."
        )
    )
    default: str = ""


class ExportMapping(BaseModel):
    """How a reviewed inquiry becomes a Sage import file."""

    format: Literal["csv", "xlsx"] = "csv"
    layout: Literal["flat", "records"] = Field(
        default="flat",
        description=(
            "flat: one row per position with header values repeated; "
            "records: one header record followed by position records."
        ),
    )
    delimiter: str = ";"
    encoding: str = "cp1252"
    header_row: bool = True
    columns: list[ExportColumn] = Field(default_factory=list)
    header_columns: list[ExportColumn] = Field(default_factory=list)
    position_columns: list[ExportColumn] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_layout(self) -> Self:
        if self.layout == "flat" and not self.columns:
            raise ValueError("flat layout requires columns")
        if self.layout == "records" and not (
            self.header_columns and self.position_columns
        ):
            raise ValueError("records layout requires header and position columns")
        return self


class SageExport(BaseModel):
    filename: str
    media_type: str
    content: bytes
