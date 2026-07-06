from sqlalchemy import ColumnElement, or_
from sqlalchemy.sql import Select

from app.models.event import Event, EventType, MeetingVisibility
from app.models.member import Member, MemberRole


def is_closed_board_meeting(event: Event) -> bool:
    if event.event_type != EventType.MEETING:
        return False
    return event.meeting_visibility != MeetingVisibility.PUBLIC


def event_visible_to_member(event: Event, member: Member) -> bool:
    if not is_closed_board_meeting(event):
        return True
    return member.has_role_at_least(MemberRole.BOARD)


def visibility_filter_expression() -> ColumnElement[bool]:
    return or_(
        Event.event_type != EventType.MEETING,
        Event.meeting_visibility == MeetingVisibility.PUBLIC,
    )


def apply_event_visibility_filter[T: Select](statement: T, member: Member) -> T:
    if member.has_role_at_least(MemberRole.BOARD):
        return statement
    return statement.where(visibility_filter_expression())
