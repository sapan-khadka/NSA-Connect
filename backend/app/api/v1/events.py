from fastapi import APIRouter

router = APIRouter(prefix="/events", tags=["events"])

# TODO: GET / — list upcoming events
# TODO: POST / — create event (board+ only)
# TODO: GET /{event_id} — get event details
# TODO: PATCH /{event_id} — update event (board+ only)
# TODO: DELETE /{event_id} — cancel event (board+ only)
# TODO: POST /{event_id}/rsvp — member RSVP to event
