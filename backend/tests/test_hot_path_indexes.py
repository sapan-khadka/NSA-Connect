"""Guard the query indexes used by calendar, tasks, finance, and volunteers."""

from app.models.event import Event
from app.models.event_task import EventTask
from app.models.finance_entry import FinanceEntry
from app.models.volunteer import VolunteerSlot


def _index_names(model) -> set[str]:
    return {index.name for index in model.__table__.indexes}


def test_events_starts_at_is_indexed():
    assert "ix_events_starts_at" in _index_names(Event)


def test_event_tasks_event_id_is_indexed():
    assert "ix_event_tasks_event_id" in _index_names(EventTask)


def test_event_tasks_assignee_id_is_indexed():
    assert "ix_event_tasks_assignee_id" in _index_names(EventTask)


def test_finance_entries_event_id_and_created_at_are_indexed():
    names = _index_names(FinanceEntry)
    assert "ix_finance_entries_event_id" in names
    assert "ix_finance_entries_created_at" in names


def test_volunteer_slots_event_id_is_indexed():
    assert "ix_volunteer_slots_event_id" in _index_names(VolunteerSlot)
