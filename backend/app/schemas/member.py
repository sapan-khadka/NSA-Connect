from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.member import MemberRole, MemberStatus

# ---------------------------------------------------------------------------
# Request schemas — validate input before it touches the database
# ---------------------------------------------------------------------------


class MemberCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class MemberUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None


class MemberLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class MemberRoleUpdateRequest(BaseModel):
    role: MemberRole


class MemberStatusUpdateRequest(BaseModel):
    status: MemberStatus


# ---------------------------------------------------------------------------
# Response schemas — safe data returned to clients (never includes password)
# ---------------------------------------------------------------------------


class MemberResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: MemberRole
    status: MemberStatus

    model_config = ConfigDict(from_attributes=True)


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int
