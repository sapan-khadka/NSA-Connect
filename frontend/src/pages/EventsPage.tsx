import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { CreateEventForm } from "../components/CreateEventForm";
import {
  EventDayPanel,
  UpcomingEventsList,
} from "../components/EventDayPanel";
import {
  EventsCalendarPanel,
  type CalendarViewMode,
} from "../components/EventsCalendarPanel";
import { EventsStatsStrip } from "../components/EventsStatsStrip";
import { UpcomingEventsStrip } from "../components/UpcomingEventsStrip";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/useAuth";
import { Drawer } from "../design-system/components/feedback/Drawer";
import { isSameDay, toLocalIsoDate, parseIsoDate } from "../lib/calendar";
import { formatMonthQuery } from "../lib/calendar-events";
import { applyRsvpStatus } from "../lib/event-rsvp";
import {
  fetchMyEventTasks,
  type EventTaskResponse,
} from "../lib/event-tasks-api";
import {
  fetchEvent,
  fetchEvents,
  fetchUpcomingEvents,
  updateEventRsvp,
  type EventDetailResponse,
  type EventResponse,
  type RsvpStatus,
} from "../lib/events-api";
import { fetchPendingFinanceChangeRequests } from "../lib/finance-api";
import { canManageTreasury, isRoleAtLeast } from "../lib/roles";

const UPCOMING_FETCH_LIMIT = 100;
const UPCOMING_STATS_WINDOW_DAYS = 14;

function countEventsWithinDays(
  events: EventResponse[],
  days: number,
  now: Date = new Date(),
): number {
  const horizonMs = now.getTime() + days * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  return events.filter((event) => {
    const startMs = Date.parse(event.starts_at);
    if (Number.isNaN(startMs)) {
      return false;
    }
    return startMs >= nowMs && startMs <= horizonMs;
  }).length;
}

function countTasksDueOnDate(
  tasks: EventTaskResponse[],
  day: Date,
): number {
  return tasks.filter(
    (task) =>
      !task.is_complete &&
      task.status !== "done" &&
      task.due_date != null &&
      isSameDay(new Date(task.due_date), day),
  ).length;
}

function countMeetingsOnDate(
  eventLists: EventResponse[][],
  day: Date,
): number {
  const seen = new Set<number>();
  let count = 0;
  for (const list of eventLists) {
    for (const event of list) {
      if (
        event.event_type !== "meeting" ||
        seen.has(event.id) ||
        !isSameDay(new Date(event.starts_at), day)
      ) {
        continue;
      }
      seen.add(event.id);
      count += 1;
    }
  }
  return count;
}

export function EventsPage() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  /** null = nothing selected (sidebar empty state). */
  const [selectionSource, setSelectionSource] = useState<
    "calendar" | "search" | "deeplink" | "create" | "strip" | null
  >(null);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [yearEvents, setYearEvents] = useState<EventResponse[]>([]);
  const [searchPool, setSearchPool] = useState<EventResponse[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventResponse[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [tasksDueTodayCount, setTasksDueTodayCount] = useState(0);
  const [financeApprovalCount, setFinanceApprovalCount] = useState(0);
  const [eventDetail, setEventDetail] = useState<EventDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [, setYearLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [upcomingDrawerOpen, setUpcomingDrawerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const showFinancePending = member
    ? canManageTreasury(member.role, member.position)
    : false;

  const upcomingEventsCount = useMemo(
    () =>
      countEventsWithinDays(
        upcomingEvents,
        UPCOMING_STATS_WINDOW_DAYS,
        today,
      ),
    [upcomingEvents, today],
  );

  const meetingsTodayCount = useMemo(
    () =>
      countMeetingsOnDate(
        [upcomingEvents, events, searchPool, yearEvents],
        today,
      ),
    [upcomingEvents, events, searchPool, yearEvents, today],
  );

  useEffect(() => {
    const dateParam = searchParams.get("date");
    const eventParam = searchParams.get("event");
    const createParam = searchParams.get("create");

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parsed = parseIsoDate(dateParam);
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      setSelectedDate(dateParam);
      setViewMode("month");
      setSelectionSource("deeplink");
      setMobileSheetOpen(true);
    }

    if (eventParam) {
      const eventId = Number(eventParam);
      if (Number.isFinite(eventId)) {
        setSelectedEventId(eventId);
        setSelectionSource("deeplink");
        setMobileSheetOpen(true);
      }
    }

    if (createParam === "1" && member && isRoleAtLeast(member.role, "board")) {
      setCreateModalOpen(true);
      navigate("/events/calendar", { replace: true });
    }
  }, [searchParams, member, navigate]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (!q?.trim()) {
      return;
    }
    // Global header search lands here with ?q= — select first name match.
    const query = q.trim().toLowerCase();
    const pool = [...searchPool, ...upcomingEvents, ...events];
    const match = pool.find((event) =>
      event.name.toLowerCase().includes(query),
    );
    if (match) {
      const eventDate = new Date(match.starts_at);
      setViewYear(eventDate.getFullYear());
      setViewMonth(eventDate.getMonth());
      setViewMode("month");
      setSelectedDate(toLocalIsoDate(eventDate));
      setSelectedEventId(match.id);
      setSelectionSource("search");
      setMobileSheetOpen(true);
    }
  }, [searchParams, searchPool, upcomingEvents, events]);

  useEffect(() => {
    let cancelled = false;

    async function loadUpcoming() {
      setUpcomingLoading(true);

      try {
        const response = await fetchUpcomingEvents({ limit: UPCOMING_FETCH_LIMIT });
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

    async function loadStatSources() {
      try {
        const tasksPromise = fetchMyEventTasks().catch(() => ({
          tasks: [] as EventTaskResponse[],
          total: 0,
        }));
        const financePromise = showFinancePending
          ? fetchPendingFinanceChangeRequests().catch(() => ({
              requests: [],
              total: 0,
            }))
          : Promise.resolve({ requests: [], total: 0 });

        const [tasksResult, financeResult] = await Promise.all([
          tasksPromise,
          financePromise,
        ]);

        if (cancelled) {
          return;
        }

        setTasksDueTodayCount(countTasksDueOnDate(tasksResult.tasks, today));
        setFinanceApprovalCount(financeResult.total);
      } catch {
        if (!cancelled) {
          setTasksDueTodayCount(0);
          setFinanceApprovalCount(0);
        }
      }
    }

    void loadStatSources();

    return () => {
      cancelled = true;
    };
  }, [showFinancePending, today]);

  useEffect(() => {
    let cancelled = false;

    async function loadSearchPool() {
      try {
        const response = await fetchEvents();
        if (!cancelled) {
          setSearchPool(response.events);
        }
      } catch {
        if (!cancelled) {
          setSearchPool([]);
        }
      }
    }

    void loadSearchPool();

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
    let cancelled = false;

    async function loadYearEvents() {
      setYearLoading(true);

      try {
        const response = await fetchEvents();
        if (!cancelled) {
          setYearEvents(
            response.events.filter(
              (event) => new Date(event.starts_at).getFullYear() === viewYear,
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setYearEvents([]);
        }
      } finally {
        if (!cancelled) {
          setYearLoading(false);
        }
      }
    }

    void loadYearEvents();

    return () => {
      cancelled = true;
    };
  }, [viewYear]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const fromMonth = events.filter(
      (event) => toLocalIsoDate(new Date(event.starts_at)) === selectedDate,
    );
    if (fromMonth.length > 0) {
      return fromMonth;
    }

    if (selectedEventId != null) {
      const fromUpcoming = upcomingEvents.find(
        (event) => event.id === selectedEventId,
      );
      if (
        fromUpcoming &&
        toLocalIsoDate(new Date(fromUpcoming.starts_at)) === selectedDate
      ) {
        return [fromUpcoming];
      }
      const fromPool = searchPool.find((event) => event.id === selectedEventId);
      if (
        fromPool &&
        toLocalIsoDate(new Date(fromPool.starts_at)) === selectedDate
      ) {
        return [fromPool];
      }
    }

    return [];
  }, [events, selectedDate, selectedEventId, upcomingEvents, searchPool]);

  useEffect(() => {
    if (loading || !selectedDate || selectionSource == null) {
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
  }, [
    loading,
    selectedDate,
    selectedDayEvents,
    selectedEventId,
    selectionSource,
  ]);

  useEffect(() => {
    if (selectedEventId === null) {
      setEventDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const detail = await fetchEvent(selectedEventId!);
        if (!cancelled) {
          setEventDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setEventDetail(null);
          setDetailError("Could not load event details.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  const applyRsvpToState = useCallback(
    (status: { event_id: number; current_member_rsvp_status: RsvpStatus | null }) => {
      setEventDetail((current) =>
        current && current.id === status.event_id
          ? applyRsvpStatus(current, status.current_member_rsvp_status)
          : current,
      );
      setEvents((current) =>
        current.map((event) =>
          event.id === status.event_id
            ? {
                ...event,
                current_member_rsvp_status: status.current_member_rsvp_status,
              }
            : event,
        ),
      );
      setUpcomingEvents((current) =>
        current.map((event) =>
          event.id === status.event_id
            ? {
                ...event,
                current_member_rsvp_status: status.current_member_rsvp_status,
              }
            : event,
        ),
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
    setSelectionSource("calendar");
    setMobileSheetOpen(true);
    const dayEvents = events.filter(
      (event) => toLocalIsoDate(new Date(event.starts_at)) === isoDate,
    );
    if (dayEvents.length === 0) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId(dayEvents[0].id);
  }

  const navigateToEvent = useCallback((event: EventResponse) => {
    const eventDate = new Date(event.starts_at);
    setViewYear(eventDate.getFullYear());
    setViewMonth(eventDate.getMonth());
    setViewMode("month");
    setSelectedDate(toLocalIsoDate(eventDate));
    setSelectedEventId(event.id);
    setSelectionSource("strip");
    setUpcomingDrawerOpen(false);
    setMobileSheetOpen(true);
  }, []);

  function handleGoToToday() {
    const now = new Date();
    const iso = toLocalIsoDate(now);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setViewMode("month");
    handleSelectDate(iso);
  }

  const handleEventCreated = useCallback(async (event: EventResponse) => {
    const eventDate = new Date(event.starts_at);
    const year = eventDate.getFullYear();
    const month = eventDate.getMonth();

    setCreateModalOpen(false);
    setViewYear(year);
    setViewMonth(month);
    setViewMode("month");
    setSelectedDate(toLocalIsoDate(eventDate));
    setSelectedEventId(event.id);
    setSelectionSource("create");
    setError(null);
    setMobileSheetOpen(true);

    try {
      const [monthResponse, allResponse] = await Promise.all([
        fetchEvents({ month: formatMonthQuery(year, month) }),
        fetchEvents(),
      ]);
      setEvents(monthResponse.events);
      setSearchPool(allResponse.events);
      setYearEvents(
        allResponse.events.filter(
          (item) => new Date(item.starts_at).getFullYear() === year,
        ),
      );
      setUpcomingEvents((current) => {
        const without = current.filter((item) => item.id !== event.id);
        return [...without, event].sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        );
      });
    } catch {
      setEvents((current) =>
        [...current, event].sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
      );
    }
  }, []);

  const hasSelection = selectedEventId != null || selectedDate != null;

  const panelProps = {
    selectedDate,
    dayEvents: selectedDayEvents,
    selectedEventId,
    onSelectEvent: (eventId: number) => {
      setSelectedEventId(eventId);
      setSelectionSource("calendar");
    },
    eventDetail,
    detailLoading,
    detailError,
    rsvpLoading,
    onRsvpStatusChange: (status: RsvpStatus) => {
      void handleRsvpStatusChange(status);
    },
    showingDefaultUpcoming: false,
  };

  return (
    <div className="events-calendar-page">
      {error ? <p className="ds-field-error">{error}</p> : null}

      <div className="events-calendar-columns">
        <div className="events-calendar-column-main min-w-0">
          <EventsStatsStrip
            className="events-calendar-stats-strip"
            today={today}
            upcomingEventsCount={upcomingEventsCount}
            tasksDueTodayCount={tasksDueTodayCount}
            financeApprovalCount={financeApprovalCount}
            meetingsTodayCount={meetingsTodayCount}
          />

          <EventsCalendarPanel
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            year={viewYear}
            month={viewMonth}
            onMonthChange={handleMonthChange}
            onGoToToday={handleGoToToday}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            monthEvents={events}
            yearEvents={yearEvents}
          />

          <UpcomingEventsStrip
            events={upcomingEvents}
            loading={upcomingLoading}
            selectedEventId={selectedEventId}
            selectedDate={selectedDate}
            onSelectEvent={navigateToEvent}
            onViewAll={() => setUpcomingDrawerOpen(true)}
          />
        </div>

        <div className="events-calendar-column-side min-w-0">
          <div className="events-calendar-side-scroll hidden md:flex md:flex-col">
            <EventDayPanel {...panelProps} presentation="aside" />
          </div>

          <div className="md:hidden">
            {hasSelection && mobileSheetOpen ? (
              <div className="events-preview-sheet-root">
                <button
                  type="button"
                  aria-label="Dismiss event preview"
                  className="events-preview-sheet-backdrop"
                  onClick={() => setMobileSheetOpen(false)}
                />
                <div className="events-preview-sheet-panel">
                  <div className="events-preview-sheet-handle" aria-hidden="true" />
                  <EventDayPanel {...panelProps} presentation="sheet" />
                </div>
              </div>
            ) : hasSelection ? (
              <button
                type="button"
                className="events-preview-sheet-peek"
                onClick={() => setMobileSheetOpen(true)}
              >
                {eventDetail?.name ??
                  selectedDayEvents[0]?.name ??
                  "Event details"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <Drawer
        open={upcomingDrawerOpen}
        onClose={() => setUpcomingDrawerOpen(false)}
        title="Upcoming events"
        description="All upcoming events on the calendar."
        side="right"
        size="md"
      >
        <UpcomingEventsList
          events={upcomingEvents}
          loading={upcomingLoading}
          onSelectEvent={navigateToEvent}
        />
      </Drawer>

      <Modal
        open={createModalOpen}
        title="New event"
        onClose={() => setCreateModalOpen(false)}
        size="lg"
      >
        <CreateEventForm
          embedded
          onCreated={(event) => void handleEventCreated(event)}
        />
      </Modal>
    </div>
  );
}
