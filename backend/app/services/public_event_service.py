from sqlalchemy.orm import Session

from app.lib.event_visibility import is_closed_board_meeting
from app.models.event import Event
from app.services.event_service import EventNotFoundError


def get_public_event(db: Session, event_id: int) -> Event:
    """Return an event that is safe to expose without authentication.

    Closed board-only meetings are treated as not found so they cannot be
    discovered through the public share endpoint.
    """
    event = db.get(Event, event_id)
    if event is None or is_closed_board_meeting(event):
        raise EventNotFoundError
    return event
