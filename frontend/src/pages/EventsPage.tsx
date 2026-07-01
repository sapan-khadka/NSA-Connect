import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { CreateEventForm } from "../components/CreateEventForm";
import { EventDayPanel } from "../components/EventDayPanel";
import { MonthlyCalendarGrid } from "../components/MonthlyCalendarGrid";
import { useAuth } from "../context/useAuth";
import { toLocalIsoDate, parseIsoDate } from "../lib/calendar";
import { formatMonthQuery } from "../lib/calendar-events";
import {
  deleteEvent,
  fetchEvent,
  fetchEvents,
  fetchUpcomingEvents,
  updateEventRsvp,
  type EventDetailResponse,
  type EventResponse,
  type PrepTaskResponse,
  type RsvpStatus,
} from "../lib/events-api";
import { applyRsvpStatus } from "../lib/event-rsvp";
import { fetchAssignableMembers } from "../lib/members-api";
import { canManageEventTasks, isRoleAtLeast } from "../lib/roles";
import type { MemberResponse } from "../lib/auth-api";

export function EventsPage() {
  const { member } = useAuth();
  const [searchParams] = useSearchParams();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventResponse[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [eventDetail, setEventDetail] = useState<EventDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [assignableMembers, setAssignableMembers] = useState<MemberResponse[]>(
    [],
  );

  const canAssignTasks = member ? isRoleAtLeast(member.role, "board") : false;
  const canDeleteEvent = canAssignTasks;
  const canManageTasks = member
    ? canManageEventTasks(member.role, member.position)
    : false;

  useEffect(() => {
    const dateParam = searchParams.get("date");
    const eventParam = searchParams.get("event");

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parsed = parseIsoDate(dateParam);
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      setSelectedDate(dateParam);
    }

    if (eventParam) {
      const eventId = Number(eventParam);
      if (Number.isFinite(eventId)) {
        setSelectedEventId(eventId);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadUpcoming() {
      setUpcomingLoading(true);

      try {
        const response = await fetchUpcomingEvents({ limit: 5 });
        if (!cancelled) {
          setUpcomingEvents(response.events);
        }
      } catch {
        if (!cancelled) {
          setUpcomingEvents([]);
        }
      } finally {
        if (!cancelled) {
          setUpcomingLoading(false);
        }
      }
    }

    void loadUpcoming();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchEvents({
          month: formatMonthQuery(viewYear, viewMonth),
        });
        if (!cancelled) {
          setEvents(response.events);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load events for this month.");
          setEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [viewYear, viewMonth]);

  useEffect(() => {
    if (!canAssignTasks) {
      setAssignableMembers([]);
      return;
    }

    let cancelled = false;

    async function loadAssignableMembers() {
      try {
        const response = await fetchAssignableMembers();
        if (!cancelled) {
          setAssignableMembers(response.members);
        }
      } catch {
        if (!cancelled) {
          setAssignableMembers([]);
        }
      }
    }

    void loadAssignableMembers();

    return () => {
      cancelled = true;
    };
  }, [canAssignTasks]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return events.filter(
      (event) => toLocalIsoDate(new Date(event.starts_at)) === selectedDate,
    );
  }, [events, selectedDate]);

  useEffect(() => {
    if (loading || !selectedDate) {
      return;
    }

    if (selectedDayEvents.length === 0) {
      return;
    }

    const stillVisible = selectedDayEvents.some(
      (event) => event.id === selectedEventId,
    );
    if (!stillVisible) {
      setSelectedEventId(selectedDayEvents[0].id);
    }
  }, [loading, selectedDate, selectedDayEvents, selectedEventId]);

  useEffect(() => {
    if (selectedEventId === null) {
      setEventDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;

    async function loadEventDetail() {
      setDetailLoading(true);
      setDetailError(null);

      const eventId = selectedEventId;
      if (eventId === null) {
        return;
      }

      try {
        const detail = await fetchEvent(eventId);
        if (!cancelled) {
          setEventDetail(detail);
          setTaskRefreshKey((current) => current + 1);
        }
      } catch {
        if (!cancelled) {
          setDetailError("Could not load event details.");
          setEventDetail(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadEventDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  const handleChecklistTasksChange = useCallback(
    (tasks: PrepTaskResponse[]) => {
      setEventDetail((current) =>
        current ? { ...current, prep_tasks: tasks } : current,
      );
    },
    [],
  );

  const applyRsvpToState = useCallback(
    (status: {
      event_id: number;
      current_member_rsvp_status: RsvpStatus | null;
    }) => {
      setEventDetail((current) =>
        current ? applyRsvpStatus(current, status) : current,
      );
      setEvents((current) =>
        current.map((event) => applyRsvpStatus(event, status)),
      );
    },
    [],
  );

  const handleRsvpStatusChange = useCallback(
    async (nextStatus: RsvpStatus) => {
      if (!eventDetail) {
        return;
      }

      const snapshot = eventDetail;
      const optimistic = {
        event_id: eventDetail.id,
        current_member_rsvp_status: nextStatus,
      };

      setRsvpLoading(true);
      applyRsvpToState(optimistic);

      try {
        const status = await updateEventRsvp(eventDetail.id, nextStatus);
        applyRsvpToState(status);
      } catch {
        setEventDetail(snapshot);
        setEvents((current) =>
          current.map((event) =>
            event.id === snapshot.id
              ? {
                  ...event,
                  current_member_rsvp_status:
                    snapshot.current_member_rsvp_status,
                }
              : event,
          ),
        );
      } finally {
        setRsvpLoading(false);
      }
    },
    [applyRsvpToState, eventDetail],
  );

  function handleMonthChange(year: number, month: number) {
    setViewYear(year);
    setViewMonth(month);
  }

  function handleSelectDate(isoDate: string) {
    setSelectedDate(isoDate);
  }

  const handleEventCreated = useCallback(async (event: EventResponse) => {
    const eventDate = new Date(event.starts_at);
    const year = eventDate.getFullYear();
    const month = eventDate.getMonth();

    setViewYear(year);
    setViewMonth(month);
    setSelectedDate(toLocalIsoDate(eventDate));
    setSelectedEventId(event.id);
    setError(null);

    try {
      const response = await fetchEvents({
        month: formatMonthQuery(year, month),
      });
      setEvents(response.events);
    } catch {
      setEvents((current) =>
        [...current, event].sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
      );
    }
  }, []);

  const handleDeleteEvent = useCallback(
    async (eventId: number) => {
      setDeletingEvent(true);
      setError(null);

      try {
        await deleteEvent(eventId);
        setEvents((current) => current.filter((event) => event.id !== eventId));
        setEventDetail((current) =>
          current && current.id === eventId ? null : current,
        );
        setSelectedEventId((current) =>
          current === eventId ? null : current,
        );
      } catch {
        setError("Could not delete this event. Please try again.");
      } finally {
        setDeletingEvent(false);
      }
    },
    [],
  );

  return (
    <div className="space-y-6">
      {canAssignTasks ? (
        <CreateEventForm onCreated={(event) => void handleEventCreated(event)} />
      ) : null}

      {loading ? (
        <p className="text-sm text-label">Loading events…</p>
      ) : null}
      {error ? <p className="ds-field-error">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <MonthlyCalendarGrid
          year={viewYear}
          month={viewMonth}
          onMonthChange={handleMonthChange}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          events={events}
        />

        <EventDayPanel
          selectedDate={selectedDate}
          dayEvents={selectedDayEvents}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          eventDetail={eventDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          member={member}
          canManageSimple={canManageTasks}
          canAssignChecklist={canAssignTasks}
          assignableMembers={assignableMembers}
          taskRefreshKey={taskRefreshKey}
          onChecklistTasksChange={handleChecklistTasksChange}
          rsvpLoading={rsvpLoading}
          onRsvpStatusChange={(status) => {
            void handleRsvpStatusChange(status);
          }}
          canDeleteEvent={canDeleteEvent}
          deletingEvent={deletingEvent}
          onDeleteEvent={(eventId) => {
            void handleDeleteEvent(eventId);
          }}
          upcomingEvents={upcomingEvents}
          upcomingLoading={upcomingLoading}
        />
      </div>
    </div>
  );
}
