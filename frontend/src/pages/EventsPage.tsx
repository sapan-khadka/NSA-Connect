import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { CreateEventForm } from "../components/CreateEventForm";
import { EventDayPanel } from "../components/EventDayPanel";
import {
  EventsCalendarPanel,
  type CalendarViewMode,
} from "../components/EventsCalendarPanel";
import { useAuth } from "../context/useAuth";
import { toLocalIsoDate, parseIsoDate } from "../lib/calendar";
import { formatMonthQuery } from "../lib/calendar-events";
import { applyRsvpStatus } from "../lib/event-rsvp";
import {
  fetchEvent,
  fetchEvents,
  fetchUpcomingEvents,
  updateEventRsvp,
  type EventDetailResponse,
  type EventResponse,
  type RsvpStatus,
} from "../lib/events-api";
import { isRoleAtLeast } from "../lib/roles";

const UPCOMING_FETCH_LIMIT = 100;

export function EventsPage() {
  const { member } = useAuth();
  const [searchParams] = useSearchParams();
  const today = new Date();
  const todayIso = toLocalIsoDate(today);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(todayIso);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [panelMode, setPanelMode] = useState<"upcoming" | "detail">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [yearEvents, setYearEvents] = useState<EventResponse[]>([]);
  const [searchPool, setSearchPool] = useState<EventResponse[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventResponse[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [eventDetail, setEventDetail] = useState<EventDetailResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [yearLoading, setYearLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const canCreateEvents = member ? isRoleAtLeast(member.role, "board") : false;

  useEffect(() => {
    const dateParam = searchParams.get("date");
    const eventParam = searchParams.get("event");

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parsed = parseIsoDate(dateParam);
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      setSelectedDate(dateParam);
      setViewMode("month");
    }

    if (eventParam) {
      const eventId = Number(eventParam);
      if (Number.isFinite(eventId)) {
        setSelectedEventId(eventId);
        setPanelMode("detail");
      }
    }
  }, [searchParams]);

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

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const seen = new Set<number>();
    const combined = [...searchPool, ...upcomingEvents, ...events, ...yearEvents];
    const matches: EventResponse[] = [];

    for (const event of combined) {
      if (seen.has(event.id)) {
        continue;
      }
      seen.add(event.id);
      if (event.name.toLowerCase().includes(query)) {
        matches.push(event);
      }
    }

    return matches.slice(0, 8);
  }, [searchQuery, searchPool, upcomingEvents, events, yearEvents]);

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

    // Keep deep-linked / in-flight selections while month data catches up.
    // Empty-day clicks clear selection in handleSelectDate instead.
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
      setUpcomingEvents((current) =>
        current.map((event) => applyRsvpStatus(event, status)),
      );
      setYearEvents((current) =>
        current.map((event) => applyRsvpStatus(event, status)),
      );
      setSearchPool((current) =>
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
    const dayEvents = events.filter(
      (event) => toLocalIsoDate(new Date(event.starts_at)) === isoDate,
    );
    if (dayEvents.length === 0) {
      setSelectedEventId(null);
      setPanelMode("upcoming");
      return;
    }
    setSelectedEventId(dayEvents[0].id);
    setPanelMode("detail");
  }

  const navigateToEvent = useCallback((event: EventResponse) => {
    const eventDate = new Date(event.starts_at);
    setViewYear(eventDate.getFullYear());
    setViewMonth(eventDate.getMonth());
    setViewMode("month");
    setSelectedDate(toLocalIsoDate(eventDate));
    setSelectedEventId(event.id);
    setPanelMode("detail");
    setSearchQuery("");
  }, []);

  function handleBackToUpcoming() {
    setPanelMode("upcoming");
  }

  const handleEventCreated = useCallback(async (event: EventResponse) => {
    const eventDate = new Date(event.starts_at);
    const year = eventDate.getFullYear();
    const month = eventDate.getMonth();

    setViewYear(year);
    setViewMonth(month);
    setViewMode("month");
    setSelectedDate(toLocalIsoDate(eventDate));
    setSelectedEventId(event.id);
    setPanelMode("detail");
    setError(null);

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

  const calendarLoading = loading || (viewMode === "year" && yearLoading);

  return (
    <div className="lg:-mx-1 lg:rounded-2xl lg:bg-[#F3F3F1] lg:px-2 lg:py-4">
      <div className="ds-mobile-edge-section lg:mb-5 lg:rounded-xl lg:border lg:border-gray-200 lg:bg-white lg:px-4 lg:py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Have an event idea?</p>
            <p className="text-xs text-label">
              Share suggestions for the board to review when planning.
            </p>
          </div>
          <Link
            to="/events/suggestions"
            className="rounded-full border border-gray-200 px-4 py-2 text-sm text-foreground hover:border-accent"
          >
            Suggest an event
          </Link>
        </div>
      </div>

      {canCreateEvents ? (
        <div className="ds-mobile-edge-section lg:mb-5">
          <CreateEventForm onCreated={(event) => void handleEventCreated(event)} />
        </div>
      ) : null}

      {calendarLoading ? (
        <p className="ds-mobile-edge-section text-sm text-label lg:px-0">Loading events…</p>
      ) : null}
      {error ? (
        <p className="ds-mobile-edge-section ds-field-error lg:px-0">{error}</p>
      ) : null}

      <div className="ds-mobile-edge-stack flex flex-col xl:grid xl:grid-cols-[minmax(0,1.75fr)_minmax(16rem,20rem)] xl:gap-6">
        <div className="ds-mobile-edge-section order-2 min-w-0 xl:order-1">
          <EventsCalendarPanel
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          year={viewYear}
          month={viewMonth}
          onMonthChange={handleMonthChange}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          monthEvents={events}
          yearEvents={yearEvents}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={searchResults}
          onSelectSearchResult={navigateToEvent}
        />
        </div>

        <div className="ds-mobile-edge-section order-1 min-w-0 xl:order-2">
        <EventDayPanel
          panelMode={panelMode}
          onBackToUpcoming={handleBackToUpcoming}
          selectedDate={selectedDate}
          dayEvents={selectedDayEvents}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          eventDetail={eventDetail}
          detailLoading={detailLoading}
          detailError={detailError}
          rsvpLoading={rsvpLoading}
          onRsvpStatusChange={(status) => {
            void handleRsvpStatusChange(status);
          }}
          upcomingEvents={upcomingEvents}
          upcomingLoading={upcomingLoading}
          onSelectUpcomingEvent={navigateToEvent}
        />
        </div>
      </div>
    </div>
  );
}
