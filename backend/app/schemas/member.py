from datetime import datetime
from typing import TYPE_CHECKING, Any

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.validators import SemoEmailStr, StudentIdStr
from app.models.member import MemberPosition, MemberRole, MemberStatus

if TYPE_CHECKING:
    from app.models.member import Member

CURRENT_YEAR = datetime.now().year
MAX_GRADUATION_YEAR = CURRENT_YEAR + 8

SENSITIVE_MEMBER_FIELDS = frozenset({"password", "hashed_password"})

# ---------------------------------------------------------------------------
# Request schemas — validate input before it touches the database
# ---------------------------------------------------------------------------


class MemberCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: SemoEmailStr
    password: str = Field(min_length=8, max_length=128)
    student_id: StudentIdStr
    major: str = Field(min_length=1, max_length=255)
    graduation_year: int = Field(ge=CURRENT_YEAR, le=MAX_GRADUATION_YEAR)


class MemberUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: SemoEmailStr | None = None


class MemberProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: SemoEmailStr | None = None
    major: str | None = Field(default=None, min_length=1, max_length=255)
    graduation_year: int | None = Field(
        default=None,
        ge=CURRENT_YEAR,
        le=MAX_GRADUATION_YEAR,
    )

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "MemberProfileUpdateRequest":
        if not any(
            value is not None
            for value in (
                self.full_name,
                self.email,
                self.major,
                self.graduation_year,
            )
        ):
            raise ValueError("At least one profile field must be provided")
        return self


class MemberLoginRequest(BaseModel):
    email: SemoEmailStr
    password: str = Field(min_length=1, max_length=128)


class MemberPasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class MemberRoleUpdateRequest(BaseModel):
    role: MemberRole


class MemberBoardRoleUpdateRequest(BaseModel):
    role: Literal[MemberRole.BOARD, MemberRole.GENERAL]


class MemberPositionUpdateRequest(BaseModel):
    position: MemberPosition


class MemberStatusUpdateRequest(BaseModel):
    status: MemberStatus


# ---------------------------------------------------------------------------
# Response schemas — explicit public API shape (never includes credentials)
# ---------------------------------------------------------------------------


class MemberResponse(BaseModel):
    """Public member profile returned by the API.

    Maps only safe fields from the database model. Passwords and hashes are
    never accepted or emitted, even if present on the ORM instance.
    """

    id: int
    full_name: str
    email: SemoEmailStr
    student_id: str
    major: str
    graduation_year: int
    role: MemberRole
    status: MemberStatus
    position: MemberPosition = MemberPosition.MEMBER

    model_config = ConfigDict(from_attributes=True)

    @field_validator("position", mode="before")
    @classmethod
    def default_missing_position(cls, value: Any) -> Any:
        return value if value is not None else MemberPosition.MEMBER

    @model_validator(mode="before")
    @classmethod
    def strip_sensitive_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: item
                for key, item in value.items()
                if key not in SENSITIVE_MEMBER_FIELDS
            }
        return value

    @classmethod
    def from_member(cls, member: "Member") -> "MemberResponse":
        return cls(
            id=member.id,
            full_name=member.full_name,
            email=member.email,
            student_id=member.student_id,
            major=member.major,
            graduation_year=member.graduation_year,
            role=member.role,
            status=member.status,
            position=member.position or MemberPosition.MEMBER,
        )

    def public_fields(self) -> set[str]:
        return set(MemberResponse.model_fields.keys())


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int


class PaginatedMemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
