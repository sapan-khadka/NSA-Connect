import { useCallback, useEffect, useMemo, useState } from "react";

import { EventDayPanel } from "../components/EventDayPanel";
import { MonthlyCalendarGrid } from "../components/MonthlyCalendarGrid";
import { useAuth } from "../context/useAuth";
import { toLocalIsoDate } from "../lib/calendar";
import { formatMonthQuery } from "../lib/calendar-events";
import {
  cancelEventRsvp,
  fetchEvent,
  fetchEvents,
  rsvpToEvent,
  type EventDetailResponse,
  type EventResponse,
  type PrepTaskResponse,
} from "../lib/events-api";
import { applyRsvpStatus } from "../lib/event-rsvp";
import {
  applyChecklistToggle,
  replacePrepTaskInList,
} from "../lib/prep-progress";
import { isRoleAtLeast } from "../lib/roles";
import { updatePrepTaskChecklistItem } from "../lib/tasks-api";

export function EventsPage() {
  const { member } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [eventDetail, setEventDetail] = useState<EventDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

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

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return events.filter(
      (event) => toLocalIsoDate(new Date(event.starts_at)) === selectedDate,
    );
  }, [events, selectedDate]);

  useEffect(() => {
    if (selectedDayEvents.length === 0) {
      setSelectedEventId(null);
      return;
    }

    const stillVisible = selectedDayEvents.some(
      (event) => event.id === selectedEventId,
    );
    if (!stillVisible) {
      setSelectedEventId(selectedDayEvents[0].id);
    }
  }, [selectedDayEvents, selectedEventId]);

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

      try {
        const detail = await fetchEvent(selectedEventId);
        if (!cancelled) {
          setEventDetail(detail);
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

  const canToggleChecklist = useCallback(
    (task: PrepTaskResponse) => {
      if (!member) {
        return false;
      }

      const isBoard = isRoleAtLeast(member.role, "board");
      const isAssignee = task.assignee_id === member.id;
      return isBoard || isAssignee;
    },
    [member],
  );

  const handleToggleChecklistItem = useCallback(
    async (taskId: number, itemId: number, isCompleted: boolean) => {
      if (!eventDetail) {
        return;
      }

      const snapshot = eventDetail;
      const task = eventDetail.prep_tasks.find((entry) => entry.id === taskId);
      if (!task || !canToggleChecklist(task)) {
        return;
      }

      setTogglingItemId(itemId);
      setEventDetail({
        ...eventDetail,
        prep_tasks: replacePrepTaskInList(
          eventDetail.prep_tasks,
          applyChecklistToggle(task, itemId, isCompleted),
        ),
      });

      try {
        const updatedTask = await updatePrepTaskChecklistItem(
          taskId,
          itemId,
          isCompleted,
        );
        setEventDetail((current) =>
          current
            ? {
                ...current,
                prep_tasks: replacePrepTaskInList(
                  current.prep_tasks,
                  updatedTask,
                ),
              }
            : current,
        );
      } catch {
        setEventDetail(snapshot);
      } finally {
        setTogglingItemId(null);
      }
    },
    [canToggleChecklist, eventDetail],
  );

  const applyRsvpToState = useCallback(
    (status: {
      event_id: number;
      rsvp_count: number;
      current_member_has_rsvped: boolean;
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

  const handleRsvp = useCallback(async () => {
    if (!eventDetail) {
      return;
    }

    const snapshot = eventDetail;
    const optimistic = {
      event_id: eventDetail.id,
      rsvp_count: eventDetail.rsvp_count + 1,
      current_member_has_rsvped: true,
    };

    setRsvpLoading(true);
    applyRsvpToState(optimistic);

    try {
      const status = await rsvpToEvent(eventDetail.id);
      applyRsvpToState(status);
    } catch {
      setEventDetail(snapshot);
      setEvents((current) =>
        current.map((event) =>
          event.id === snapshot.id
            ? {
                ...event,
                rsvp_count: snapshot.rsvp_count,
                current_member_has_rsvped: snapshot.current_member_has_rsvped,
              }
            : event,
        ),
      );
    } finally {
      setRsvpLoading(false);
    }
  }, [applyRsvpToState, eventDetail]);

  const handleCancelRsvp = useCallback(async () => {
    if (!eventDetail) {
      return;
    }

    const snapshot = eventDetail;
    const optimistic = {
      event_id: eventDetail.id,
      rsvp_count: Math.max(0, eventDetail.rsvp_count - 1),
      current_member_has_rsvped: false,
    };

    setRsvpLoading(true);
    applyRsvpToState(optimistic);

    try {
      const status = await cancelEventRsvp(eventDetail.id);
      applyRsvpToState(status);
    } catch {
      setEventDetail(snapshot);
      setEvents((current) =>
        current.map((event) =>
          event.id === snapshot.id
            ? {
                ...event,
                rsvp_count: snapshot.rsvp_count,
                current_member_has_rsvped: snapshot.current_member_has_rsvped,
              }
            : event,
        ),
      );
    } finally {
      setRsvpLoading(false);
    }
  }, [applyRsvpToState, eventDetail]);

  function handleMonthChange(year: number, month: number) {
    setViewYear(year);
    setViewMonth(month);
  }

  function handleSelectDate(isoDate: string) {
    setSelectedDate(isoDate);
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-primary">Events</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Browse NSA events by month, RSVP to attend, and track prep progress.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-gray-500">Loading events…</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

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
          canToggleChecklist={canToggleChecklist}
          togglingItemId={togglingItemId}
          onToggleChecklistItem={(taskId, itemId, isCompleted) => {
            void handleToggleChecklistItem(taskId, itemId, isCompleted);
          }}
          rsvpLoading={rsvpLoading}
          onRsvp={() => {
            void handleRsvp();
          }}
          onCancelRsvp={() => {
            void handleCancelRsvp();
          }}
        />
      </div>
    </div>
  );
}
