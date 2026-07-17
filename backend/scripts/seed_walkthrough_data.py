"""Seed Member Workspace walkthrough fixtures (WT-* events + related rows).

Originally run as a one-shot agent script against the local DB — never checked in.
The bug: starts_at used datetime.now(UTC) ± timedelta(days=N), so the wall-clock
"now" (e.g. 04:02:30 UTC → 11:02 PM Chicago) leaked into every event.

Usage (from backend/):
    python -m scripts.seed_walkthrough_data
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select, update

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.event import Event, EventType, MeetingVisibility
from app.models.event_checkin import EventCheckIn
from app.models.event_participant_invitation import EventParticipantInvitation
from app.models.event_rsvp import EventRsvp, RsvpStatus
from app.models.event_task import EventTask, EventTaskKind, EventTaskStatus
from app.models.finance_entry import FinanceEntry
from app.models.meeting import MeetingAttendance, MeetingAttendanceStatus, MeetingRecord
from app.models.member import Member, MemberPosition, MemberRole, MemberStatus
from app.models.member_document import MemberDocument, MemberDocumentType
from app.models.member_dues import MemberDues
from app.models.notification_sent_log import NotificationSentLog
from app.models.reminder import PrepTaskReminder
from app.models.volunteer import VolunteerSignup, VolunteerSlot

# Match create-form default event_time ("18:00") as local wall clock.
LOCAL_TZ = ZoneInfo("America/Chicago")
EVENT_HOUR = 18
EVENT_MINUTE = 0

PWD = "WalkthroughPass123!"


def starts_at_local(*, days_from_today: int) -> datetime:
    """Calendar day offset from today, at an explicit local hour (not now())."""
    today_local = datetime.now(LOCAL_TZ).date()
    day = today_local + timedelta(days=days_from_today)
    return datetime(
        day.year,
        day.month,
        day.day,
        EVENT_HOUR,
        EVENT_MINUTE,
        tzinfo=LOCAL_TZ,
    )


def claim_exclusive_position_if_free(
    db,
    *,
    preferred: MemberPosition,
    email: str,
) -> MemberPosition:
    """Use preferred exclusive seat only if unclaimed or already ours.

    Never steals another member's exclusive position (e.g. real president).
    Falls back to MEMBER so ix_members_exclusive_position cannot fail the seed.
    """
    if preferred == MemberPosition.MEMBER:
        return MemberPosition.MEMBER
    holder = db.scalar(select(Member).where(Member.position == preferred))
    if holder is None or holder.email == email:
        return preferred
    return MemberPosition.MEMBER


def seed_walkthrough_data() -> None:
    db = SessionLocal()
    hp = hash_password(PWD)

    try:
        def upsert(email: str, **kwargs) -> Member:
            member = db.scalar(select(Member).where(Member.email == email))
            if member is None:
                member = Member(email=email, hashed_password=hp, **kwargs)
                db.add(member)
                db.flush()
            else:
                for key, value in kwargs.items():
                    setattr(member, key, value)
                member.hashed_password = hp
                member.status = MemberStatus.APPROVED
            return member

        officer_email = "walkthrough-officer@semo.edu"
        officer_position = claim_exclusive_position_if_free(
            db,
            preferred=MemberPosition.PRESIDENT,
            email=officer_email,
        )
        # Prefer president role only when we actually hold the seat; otherwise
        # board + member (non-exclusive) — do not touch the real president row.
        officer_role = (
            MemberRole.PRESIDENT
            if officer_position == MemberPosition.PRESIDENT
            else MemberRole.BOARD
        )
        officer = upsert(
            officer_email,
            full_name="Walkthrough Officer",
            student_id="WT000001",
            major="CS",
            graduation_year=2027,
            role=officer_role,
            position=officer_position,
            status=MemberStatus.APPROVED,
        )

        rich_email = "walkthrough-rich@semo.edu"
        rich_position = claim_exclusive_position_if_free(
            db,
            preferred=MemberPosition.SECRETARY,
            email=rich_email,
        )
        rich = upsert(
            rich_email,
            full_name="Walkthrough Rich Member",
            student_id="WT000002",
            major="Biology",
            graduation_year=2028,
            role=MemberRole.BOARD,
            position=rich_position,
            status=MemberStatus.APPROVED,
        )
        empty = upsert(
            "walkthrough-empty@semo.edu",
            full_name="Walkthrough Empty Member",
            student_id="WT000003",
            major="Art",
            graduation_year=2029,
            role=MemberRole.GENERAL,
            position=MemberPosition.MEMBER,
            status=MemberStatus.APPROVED,
        )
        general = upsert(
            "walkthrough-general@semo.edu",
            full_name="Walkthrough General Self",
            student_id="WT000004",
            major="Math",
            graduation_year=2028,
            role=MemberRole.GENERAL,
            position=MemberPosition.MEMBER,
            status=MemberStatus.APPROVED,
        )
        db.flush()

        member_ids = [rich.id, general.id, empty.id]

        # Clear prior walkthrough member-scoped rows.
        for model, column in [
            (MemberDues, MemberDues.member_id),
            (MemberDocument, MemberDocument.member_id),
            (EventTask, EventTask.assignee_id),
            (EventCheckIn, EventCheckIn.member_id),
            (MeetingAttendance, MeetingAttendance.member_id),
            (EventRsvp, EventRsvp.member_id),
        ]:
            db.execute(delete(model).where(column.in_(member_ids)))

        # Clear NO ACTION children for WT events only, then delete those events.
        # Scoped by event_id (not member) so e.g. mukesh@semo.edu RSVPs are included.
        wt_event_ids = select(Event.id).where(Event.title.like("WT %"))
        wt_task_ids = select(EventTask.id).where(EventTask.event_id.in_(wt_event_ids))
        wt_slot_ids = select(VolunteerSlot.id).where(
            VolunteerSlot.event_id.in_(wt_event_ids),
        )

        # Task-related children before event_tasks (checklist items CASCADE).
        db.execute(
            delete(PrepTaskReminder).where(
                PrepTaskReminder.event_task_id.in_(wt_task_ids),
            ),
        )
        db.execute(
            delete(NotificationSentLog).where(
                NotificationSentLog.event_id.in_(wt_event_ids)
                | NotificationSentLog.event_task_id.in_(wt_task_ids),
            ),
        )

        # Volunteer slots: signups before slots.
        db.execute(
            delete(VolunteerSignup).where(VolunteerSignup.slot_id.in_(wt_slot_ids)),
        )
        db.execute(
            delete(VolunteerSlot).where(VolunteerSlot.event_id.in_(wt_event_ids)),
        )

        db.execute(delete(EventRsvp).where(EventRsvp.event_id.in_(wt_event_ids)))
        db.execute(
            delete(MeetingAttendance).where(
                MeetingAttendance.event_id.in_(wt_event_ids),
            ),
        )
        db.execute(
            delete(MeetingRecord).where(MeetingRecord.event_id.in_(wt_event_ids)),
        )
        db.execute(
            delete(EventParticipantInvitation).where(
                EventParticipantInvitation.event_id.in_(wt_event_ids),
            ),
        )
        db.execute(delete(EventTask).where(EventTask.event_id.in_(wt_event_ids)))

        # Preserve ledger rows; only detach from WT events.
        db.execute(
            update(FinanceEntry)
            .where(FinanceEntry.event_id.in_(wt_event_ids))
            .values(event_id=None),
        )

        db.execute(delete(Event).where(Event.title.like("WT %")))
        db.flush()

        # Meetings: past offsets negative, one upcoming.
        # Was: starts_at=now ± timedelta(days=N)  ← leaked now()'s clock time
        meeting_day_offsets = [-40, -30, -20, -10, 5]
        meetings: list[Event] = []
        for index, days_from_today in enumerate(meeting_day_offsets):
            meeting = Event(
                title=f"WT Meeting {index + 1}",
                description="Walkthrough meeting",
                event_type=EventType.MEETING,
                meeting_visibility=MeetingVisibility.BOARD_ONLY,
                starts_at=starts_at_local(days_from_today=days_from_today),
                budget=Decimal("0"),
                created_by_id=officer.id,
                location="Campus",
            )
            db.add(meeting)
            meetings.append(meeting)

        cultural = Event(
            title="WT Cultural Night",
            description="Upcoming cultural",
            event_type=EventType.CULTURAL,
            starts_at=starts_at_local(days_from_today=14),
            budget=Decimal("100"),
            created_by_id=officer.id,
            location="Hall",
        )
        db.add(cultural)

        past_social = Event(
            title="WT Past Social",
            description="past",
            event_type=EventType.SOCIAL,
            starts_at=starts_at_local(days_from_today=-7),
            budget=Decimal("50"),
            created_by_id=officer.id,
        )
        db.add(past_social)
        db.flush()

        now_utc = datetime.now(LOCAL_TZ).astimezone(ZoneInfo("UTC"))

        for meeting in meetings[:3]:
            if meeting.starts_at < now_utc:
                db.add(
                    MeetingAttendance(
                        event_id=meeting.id,
                        member_id=rich.id,
                        status=MeetingAttendanceStatus.ABSENT,
                    ),
                )

        db.add(
            MemberDues(
                member_id=rich.id,
                semester="2025-fall",
                amount_owed=Decimal("20"),
                amount_paid=Decimal("20"),
                paid_at=starts_at_local(days_from_today=-120),
            ),
        )
        db.add(
            MemberDues(
                member_id=rich.id,
                semester="2026-spring",
                amount_owed=Decimal("25"),
                amount_paid=Decimal("0"),
            ),
        )
        db.add(
            MemberDues(
                member_id=general.id,
                semester="2026-spring",
                amount_owed=Decimal("25"),
                amount_paid=Decimal("25"),
                paid_at=starts_at_local(days_from_today=-10),
            ),
        )

        for title, status, due_offset, created_offset in [
            ("Book venue", EventTaskStatus.TODO, -14, -20),
            ("Order snacks", EventTaskStatus.DONE, -5, -18),
            ("Print flyers", EventTaskStatus.DONE, -3, -15),
            ("Confirm DJ", EventTaskStatus.DONE, 5, -10),
        ]:
            db.add(
                EventTask(
                    event_id=cultural.id,
                    title=title,
                    description="",
                    task_kind=EventTaskKind.SIMPLE,
                    assignee_id=rich.id,
                    status=status,
                    due_date=starts_at_local(days_from_today=due_offset),
                    completed_at=(
                        starts_at_local(days_from_today=-2)
                        if status == EventTaskStatus.DONE
                        else None
                    ),
                    created_by_id=officer.id,
                    created_at=starts_at_local(days_from_today=created_offset),
                ),
            )

        db.add(
            EventCheckIn(
                event_id=past_social.id,
                member_id=rich.id,
                checked_in_at=starts_at_local(days_from_today=-7),
            ),
        )
        rsvp_now = datetime.now(UTC)
        db.add(
            EventRsvp(
                event_id=cultural.id,
                member_id=rich.id,
                status=RsvpStatus.GOING,
                created_at=rsvp_now,
                updated_at=rsvp_now,
            ),
        )

        db.add(
            MemberDocument(
                member_id=rich.id,
                uploaded_by_id=officer.id,
                file_url="https://example.com/rich-resume.pdf",
                file_name="Rich Resume.pdf",
                document_type=MemberDocumentType.RESUME,
                public_id="nsa-connect/member-documents/wt-rich",
                resource_type="raw",
            ),
        )
        db.add(
            MemberDocument(
                member_id=general.id,
                uploaded_by_id=general.id,
                file_url="https://example.com/general-waiver.pdf",
                file_name="My Waiver.pdf",
                document_type=MemberDocumentType.WAIVER,
                public_id="nsa-connect/member-documents/wt-general",
                resource_type="raw",
            ),
        )

        db.commit()
        print(
            {
                "password": PWD,
                "officer": {
                    "id": officer.id,
                    "email": officer.email,
                    "role": officer.role.value,
                    "position": officer.position.value,
                },
                "rich": {
                    "id": rich.id,
                    "email": rich.email,
                    "role": rich.role.value,
                    "position": rich.position.value,
                },
                "empty": {"id": empty.id, "email": empty.email},
                "general": {"id": general.id, "email": general.email},
                "cultural_starts_at": cultural.starts_at.isoformat(),
            },
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed_walkthrough_data()
