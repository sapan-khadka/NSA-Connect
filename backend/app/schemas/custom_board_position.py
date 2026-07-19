from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.member import MemberPosition


class CustomBoardPositionSummary(BaseModel):
    id: int
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class CustomBoardPositionHolderSummary(BaseModel):
    id: int
    full_name: str


class CustomBoardPositionResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None
    holder: CustomBoardPositionHolderSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class CustomBoardPositionListResponse(BaseModel):
    positions: list[CustomBoardPositionResponse]
    total: int


class BuiltInBoardPositionResponse(BaseModel):
    key: MemberPosition
    label: str
    immutable: Literal[True] = True


class MemberPositionCatalogResponse(BaseModel):
    built_in: list[BuiltInBoardPositionResponse]
    custom: list[CustomBoardPositionResponse]


class CustomBoardPositionCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class CustomBoardPositionRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned


class MemberPositionUpdateRequest(BaseModel):
    """Assign a fixed built-in seat or a custom catalog seat."""

    kind: Literal["fixed", "custom"]
    position: MemberPosition | None = None
    custom_board_position_id: int | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "MemberPositionUpdateRequest":
        if self.kind == "fixed":
            if self.position is None:
                raise ValueError("position is required when kind is 'fixed'")
            if self.custom_board_position_id is not None:
                raise ValueError(
                    "custom_board_position_id must be omitted when kind is 'fixed'",
                )
        else:
            if self.custom_board_position_id is None:
                raise ValueError(
                    "custom_board_position_id is required when kind is 'custom'",
                )
            if self.position is not None:
                raise ValueError("position must be omitted when kind is 'custom'")
        return self
