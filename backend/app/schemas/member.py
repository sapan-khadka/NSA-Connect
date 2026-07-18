from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)

from app.core.password_validation import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
)
from app.core.validators import SemoEmailStr, StudentIdStr
from app.lib.member_talents import is_valid_talent
from app.models.member import (
    MemberPosition,
    MemberRole,
    MemberStatus,
    ProfileFieldVisibility,
)

if TYPE_CHECKING:
    from app.models.member import Member

CURRENT_YEAR = datetime.now().year
MAX_GRADUATION_YEAR = CURRENT_YEAR + 8

SENSITIVE_MEMBER_FIELDS = frozenset({"password", "hashed_password"})


class MemberIdentityRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: SemoEmailStr
    student_id: StudentIdStr
    major: str = Field(min_length=1, max_length=255)
    graduation_year: int = Field(ge=CURRENT_YEAR, le=MAX_GRADUATION_YEAR)


class MemberCreateRequest(MemberIdentityRequest):
    password: str = Field(
        min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )


class MemberInviteRequest(MemberIdentityRequest):
    phone: str | None = Field(default=None, max_length=32)

    @field_validator("phone", mode="before")
    @classmethod
    def strip_optional_phone(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class MemberImportSkippedRow(BaseModel):
    row_number: int
    email: str | None = None
    reason: str


class MemberImportResponse(BaseModel):
    rows_created: int
    rows_skipped: int
    skipped_rows: list[MemberImportSkippedRow]


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
    interests: str | None = Field(default=None, max_length=1000)
    bio: str | None = Field(default=None, max_length=2000)
    talents: list[str] | None = None
    talent_other: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    social_handle: str | None = Field(default=None, max_length=255)
    email_visibility: ProfileFieldVisibility | None = None
    phone_visibility: ProfileFieldVisibility | None = None
    social_handle_visibility: ProfileFieldVisibility | None = None

    @field_validator(
        "interests", "bio", "talent_other", "phone", "social_handle", mode="before"
    )
    @classmethod
    def strip_optional_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("talents")
    @classmethod
    def validate_talents(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        if not value:
            return []
        deduped: list[str] = []
        for talent in value:
            if talent not in deduped:
                if not is_valid_talent(talent):
                    raise ValueError(f"Invalid talent: {talent}")
                deduped.append(talent)
        return deduped

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "MemberProfileUpdateRequest":
        if not any(
            value is not None
            for value in (
                self.full_name,
                self.email,
                self.major,
                self.graduation_year,
                self.interests,
                self.bio,
                self.talents,
                self.talent_other,
                self.phone,
                self.social_handle,
                self.email_visibility,
                self.phone_visibility,
                self.social_handle_visibility,
            )
        ):
            raise ValueError("At least one profile field must be provided")
        if self.talents and "other" in self.talents and not self.talent_other:
            raise ValueError("Describe your other talent when selecting Other")
        return self


class MemberLoginRequest(BaseModel):
    email: SemoEmailStr
    password: str = Field(min_length=1, max_length=128)


class MemberPasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(
        min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH
    )


class MemberRoleUpdateRequest(BaseModel):
    role: MemberRole


class MemberBoardRoleUpdateRequest(BaseModel):
    role: Literal[MemberRole.BOARD, MemberRole.GENERAL]


class MemberPositionUpdateRequest(BaseModel):
    position: MemberPosition


class MemberStatusUpdateRequest(BaseModel):
    status: MemberStatus


class MemberResponse(BaseModel):
    id: int
    full_name: str
    email: str | None = None
    student_id: str | None = None
    major: str
    graduation_year: int
    role: MemberRole
    status: MemberStatus
    position: MemberPosition = MemberPosition.MEMBER
    interests: str | None = None
    bio: str | None = None
    talents: list[str] = Field(default_factory=list)
    talent_other: str | None = None
    phone: str | None = None
    social_handle: str | None = None
    email_visibility: ProfileFieldVisibility = ProfileFieldVisibility.PUBLIC
    phone_visibility: ProfileFieldVisibility = ProfileFieldVisibility.BOARD_ONLY
    social_handle_visibility: ProfileFieldVisibility = ProfileFieldVisibility.BOARD_ONLY

    model_config = ConfigDict(from_attributes=True)

    @field_validator("position", mode="before")
    @classmethod
    def default_missing_position(cls, value: Any) -> Any:
        return value if value is not None else MemberPosition.MEMBER

    @field_validator("talents", mode="before")
    @classmethod
    def default_talents(cls, value: Any) -> list[str]:
        if value is None:
            return []
        return list(value)

    @field_validator(
        "email_visibility",
        "phone_visibility",
        "social_handle_visibility",
        mode="before",
    )
    @classmethod
    def default_visibility(
        cls, value: Any, info: ValidationInfo
    ) -> ProfileFieldVisibility:
        if value is not None:
            return value
        defaults = {
            "email_visibility": ProfileFieldVisibility.PUBLIC,
            "phone_visibility": ProfileFieldVisibility.BOARD_ONLY,
            "social_handle_visibility": ProfileFieldVisibility.BOARD_ONLY,
        }
        return defaults[info.field_name]

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
    def from_member(
        cls,
        member: "Member",
        *,
        viewer: "Member | None" = None,
    ) -> "MemberResponse":
        is_self = viewer is not None and viewer.id == member.id
        is_board = viewer is not None and viewer.has_role_at_least(MemberRole.BOARD)

        email_visibility = member.email_visibility or ProfileFieldVisibility.PUBLIC
        phone_visibility = member.phone_visibility or ProfileFieldVisibility.BOARD_ONLY
        social_handle_visibility = (
            member.social_handle_visibility or ProfileFieldVisibility.BOARD_ONLY
        )

        def field_visible(visibility: ProfileFieldVisibility) -> bool:
            if is_self or is_board:
                return True
            return visibility == ProfileFieldVisibility.PUBLIC

        email = member.email if field_visible(email_visibility) else None
        phone = (
            member.phone if member.phone and field_visible(phone_visibility) else None
        )
        social_handle = (
            member.social_handle
            if member.social_handle and field_visible(social_handle_visibility)
            else None
        )
        student_id = member.student_id if is_self or is_board else None

        return cls(
            id=member.id,
            full_name=member.full_name,
            email=email,
            student_id=student_id,
            major=member.major,
            graduation_year=member.graduation_year,
            role=member.role,
            status=member.status,
            position=member.position or MemberPosition.MEMBER,
            interests=member.interests,
            bio=member.bio,
            talents=list(member.talents or []),
            talent_other=member.talent_other,
            phone=phone,
            social_handle=social_handle,
            email_visibility=email_visibility,
            phone_visibility=phone_visibility,
            social_handle_visibility=social_handle_visibility,
        )


class MemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int


class PaginatedMemberListResponse(BaseModel):
    members: list[MemberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MemberTalentOptionsResponse(BaseModel):
    talents: list[str]
    labels: dict[str, str]


class EventParticipantInvitationCreateRequest(BaseModel):
    member_ids: list[int] = Field(min_length=1)


class EventParticipantInvitationResponse(BaseModel):
    id: int
    event_id: int
    member_id: int
    member_name: str
    invited_by_id: int
    invited_by_name: str
    created_at: datetime

    @classmethod
    def from_invitation(cls, invitation) -> "EventParticipantInvitationResponse":
        return cls(
            id=invitation.id,
            event_id=invitation.event_id,
            member_id=invitation.member_id,
            member_name=invitation.member.full_name,
            invited_by_id=invitation.invited_by_id,
            invited_by_name=invitation.invited_by.full_name,
            created_at=invitation.created_at,
        )


class EventParticipantInvitationListResponse(BaseModel):
    invitations: list[EventParticipantInvitationResponse]
    total: int
