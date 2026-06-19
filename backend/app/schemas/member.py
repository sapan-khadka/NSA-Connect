from pydantic import BaseModel, ConfigDict, Field

from app.models.member import MemberRole, MemberStatus


class MemberBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)


class MemberCreate(MemberBase):
    password: str = Field(min_length=8, max_length=128)


class MemberRead(MemberBase):
    id: int
    role: MemberRole
    status: MemberStatus

    model_config = ConfigDict(from_attributes=True)
