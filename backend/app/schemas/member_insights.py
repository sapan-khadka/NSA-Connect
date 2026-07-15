from pydantic import BaseModel, Field


class MemberMeetingAttendanceStreakResponse(BaseModel):
    """Deterministic trailing miss count from MeetingAttendance (meetings only)."""

    member_id: int
    consecutive_missed_meetings: int = Field(
        ...,
        ge=0,
        description=(
            "Count of consecutive ABSENT meeting roll-call marks from the "
            "newest past meeting with a recorded status for this member. "
            "PRESENT breaks the streak; EXCUSED is skipped."
        ),
    )
