from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.validators import SemoEmailStr
from app.models.member import MemberRole, MemberStatus

CURRENT_YEAR = datetime.now().year
MAX_GRADUATION_YEAR = CURRENT_YEAR + 8

# ---------------------------------------------------------------------------
# Request schemas — validate input before it touches the database
# ---------------------------------------------------------------------------


class MemberCreateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: SemoEmailStr
    password: str = Field(min_length=8, max_length=128)
    student_id: str = Field(min_length=6, max_length=20, pattern=r"^\d+$")
    major: str = Field(min_length=1, max_length=255)
    graduation_year: int = Field(ge=CURRENT_YEAR, le=MAX_GRADUATION_YEAR)


class MemberUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: SemoEmailStr | None = None


class MemberLoginRequest(BaseModel):
    email: SemoEmailStr
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
    email: SemoEmailStr
    student_id: str
    major: str
    graduation_year: int
    role: MemberRole
    status: MemberStatus

    model_config = ConfigDict(from_attributes=True)


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int
