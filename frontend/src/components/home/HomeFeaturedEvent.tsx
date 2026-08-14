import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router";

const nsaCover = new URL("../../assets/nsa-cover.PNG", import.meta.url).href;
import {
  EVENT_TYPE_COLOR,
  EVENT_TYPE_LABELS,
} from "../../lib/event-types";
import {
  fetchEventAttendees,
  type EventResponse,
} from "../../lib/events-api";
import { eventDetailPath } from "../../lib/event-links";
import { formatCountdownBadge } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";

function formatEventTime(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function getDateBlockParts(isoDate: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const date = new Date(isoDate);
  return {
    month: new Intl.DateTimeFormat(undefined, { month: "short" })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date),
    weekday: new Intl.DateTimeFormat(undefined, { weekday: "short" })
      .format(date)
      .toUpperCase(),
  };
}

function computeRsvpHealth({
  going,
  maybe,
  notGoing,
  capacity,
}: {
  going: number | null;
  maybe: number | null;
  notGoing: number | null;
  capacity: number | null;
}): number | null {
  if (going == null) {
    return null;
  }
  if (capacity != null && capacity > 0) {
    return Math.min(100, Math.round((going / capacity) * 100));
  }
  const maybeSafe = maybe ?? 0;
  const notGoingSafe = notGoing ?? 0;
  const responded = going + maybeSafe + notGoingSafe;
  if (responded <= 0) {
    return null;
  }
  return Math.round((going / responded) * 100);
}

function eventBannerImage(event: EventResponse | null): string {
  const custom = event?.event_photo_url?.trim();
  if (custom) {
    return custom;
  }
  return nsaCover;
}

function FeaturedCarouselControls({
  index,
  total,
  onPrev,
  onNext,
  tone = "dark",
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  tone?: "dark" | "light";
}) {
  if (total <= 1) {
    return null;
  }

  return (
    <div
      className={[
        "home-featured-banner__nav",
        tone === "light" ? "is-light" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Featured event carousel"
    >
      <button
        type="button"
        aria-label="Previous upcoming event"
        onClick={onPrev}
        className="home-featured-banner__nav-btn"
      >
        <AppIcon icon={ChevronLeft} size="sm" />
      </button>
      <span className="home-featured-banner__nav-count" aria-live="polite">
        {index + 1}/{total}
      </span>
      <button
        type="button"
        aria-label="Next upcoming event"
        onClick={onNext}
        className="home-featured-banner__nav-btn"
      >
        <AppIcon icon={ChevronRight} size="sm" />
      </button>
    </div>
  );
}

function formatEventDateShort(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

type HomeFeaturedEventProps = {
  events: EventResponse[];
  canManage?: boolean;
  canCreateEvent?: boolean;
  isLoading: boolean;
  density?: "xs" | "sm" | "md" | "lg" | "xl";
  contentScale?: number;
  /**
   * `hero` — photo banner (edit canvas / large widgets).
   * `strip` — dense row for medium widgets.
   * `line` — document row for Home briefing (no hero photo).
   */
  presentation?: "hero" | "strip" | "line";
};

/**
 * Next-event spotlight — briefing line by default, hero/strip on freeform edit.
 */
export function HomeFeaturedEvent({
  events,
  canManage = false,
  canCreateEvent = false,
  isLoading,
  density = "lg",
  contentScale = 1,
  presentation = "hero",
}: HomeFeaturedEventProps) {
  const [index, setIndex] = useState(0);
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [maybeCount, setMaybeCount] = useState<number | null>(null);
  const [notGoingCount, setNotGoingCount] = useState<number | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  const safeIndex = events.length === 0 ? 0 : Math.min(index, events.length - 1);
  const event = events[safeIndex] ?? null;
  const eventIdsKey = events.map((item) => item.id).join(",");
  const useLine = presentation === "line";
  const useHero =
    !useLine && presentation === "hero" && density !== "xs" && density !== "sm";

  useEffect(() => {
    setIndex(0);
  }, [eventIdsKey]);

  useEffect(() => {
    setPhotoLoaded(false);
  }, [event?.id, event?.event_photo_url]);

  useEffect(() => {
    if (!event || useLine) {
      setGoingCount(null);
      setMaybeCount(null);
      setNotGoingCount(null);
      return;
    }

    let cancelled = false;
    void fetchEventAttendees(event.id)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setGoingCount(response.going_count);
        setMaybeCount(response.maybe_count);
        setNotGoingCount(response.not_going_count);
      })
      .catch(() => {
        if (!cancelled) {
          setGoingCount(null);
          setMaybeCount(null);
          setNotGoingCount(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [event?.id, useLine]);

  function goPrev() {
    setIndex((current) =>
      events.length === 0
        ? 0
        : (current - 1 + events.length) % events.length,
    );
  }

  function goNext() {
    setIndex((current) =>
      events.length === 0 ? 0 : (current + 1) % events.length,
    );
  }

  if (useLine) {
    return (
      <FeaturedEventLine
        event={event}
        isLoading={isLoading}
        safeIndex={safeIndex}
        total={events.length}
        canCreateEvent={canCreateEvent}
        onPrev={goPrev}
        onNext={goNext}
      />
    );
  }

  /* ——— Compact strip for small widget sizes ——— */
  if (!useHero) {
    return (
      <FeaturedEventStrip
        event={event}
        isLoading={isLoading}
        density={density}
        contentScale={contentScale}
        safeIndex={safeIndex}
        total={events.length}
        goingCount={goingCount}
        notGoingCount={notGoingCount}
        maybeCount={maybeCount}
        canManage={canManage}
        canCreateEvent={canCreateEvent}
        onPrev={goPrev}
        onNext={goNext}
      />
    );
  }

  /* ——— Photo hero ——— */
  const bannerImage = eventBannerImage(event);
  const accent = event
    ? EVENT_TYPE_COLOR[event.event_type]
    : "#111111";

  if (isLoading) {
    return (
      <section
        aria-label="Featured Event"
        className="home-featured-banner is-loading"
        data-density={density}
      >
        <div className="home-featured-banner__media" aria-hidden="true">
          <img src={nsaCover} alt="" className="home-featured-banner__photo" />
          <div className="home-featured-banner__scrim" />
        </div>
        <div className="home-featured-banner__body">
          <div className="home-featured-banner__skeleton" />
        </div>
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className="home-featured-banner is-empty"
        data-density={density}
      >
        <div className="home-featured-banner__media" aria-hidden="true">
          <img src={nsaCover} alt="" className="home-featured-banner__photo" />
          <div className="home-featured-banner__scrim" />
        </div>
        <div className="home-featured-banner__body home-featured-banner__body--empty">
          <p className="home-featured-banner__kicker">Upcoming event</p>
          <h2 className="home-featured-banner__title">No upcoming events</h2>
          <p className="home-featured-banner__lede">
            {canCreateEvent
              ? "Schedule the next gathering and it will take this stage."
              : "When something is scheduled, it will appear here with its cover."}
          </p>
          <div className="home-featured-banner__actions">
            {canCreateEvent ? (
              <Link
                to="/events/calendar?create=1"
                className="home-featured-banner__btn home-featured-banner__btn--primary"
              >
                Create event
              </Link>
            ) : null}
            <Link
              to="/events/calendar"
              className="home-featured-banner__btn home-featured-banner__btn--ghost"
            >
              View calendar
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const eventPath = eventDetailPath(event.id);
  const managePath = `${eventPath}/manage`;
  const countdown = formatCountdownBadge(event.starts_at);
  const location = event.location?.trim() || "Location TBA";
  const dateBlock = getDateBlockParts(event.starts_at);
  const whenLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.starts_at));
  const rsvpHealth = computeRsvpHealth({
    going: goingCount,
    maybe: maybeCount,
    notGoing: notGoingCount,
    capacity: event.capacity,
  });
  const typeLabel = EVENT_TYPE_LABELS[event.event_type];
  const goingLabel =
    goingCount == null ? "—" : String(goingCount);
  const rsvpLabel = rsvpHealth == null ? "—" : `${rsvpHealth}%`;

  return (
    <section
      aria-label="Featured Event"
      className={[
        "home-featured-banner",
        photoLoaded ? "is-ready" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-density={density}
      style={
        {
          ["--featured-accent" as string]: accent,
        } as CSSProperties
      }
    >
      <div className="home-featured-banner__media" aria-hidden="true">
        <img
          src={bannerImage}
          alt=""
          className="home-featured-banner__photo"
          onLoad={() => setPhotoLoaded(true)}
        />
        <div className="home-featured-banner__scrim" />
        <div className="home-featured-banner__glow" />
      </div>

      <div className="home-featured-banner__body">
        <header className="home-featured-banner__top">
          <p className="home-featured-banner__kicker">Upcoming event</p>
          <div className="home-featured-banner__pills">
            <span className="home-featured-banner__pill">{typeLabel}</span>
            <span className="home-featured-banner__pill home-featured-banner__pill--countdown">
              {countdown}
            </span>
          </div>
        </header>

        <div className="home-featured-banner__main">
          <div className="home-featured-banner__date" aria-hidden="true">
            <span className="home-featured-banner__date-month">
              {dateBlock.month}
            </span>
            <span className="home-featured-banner__date-day">
              {dateBlock.day}
            </span>
            <span className="home-featured-banner__date-weekday">
              {dateBlock.weekday}
            </span>
          </div>

          <div className="home-featured-banner__copy">
            <h2 className="home-featured-banner__title">
              <Link to={eventPath} className="home-featured-banner__title-link">
                {event.name}
              </Link>
            </h2>
            <p className="home-featured-banner__when">
              <AppIcon icon={Calendar} size="xs" />
              <span>{whenLine}</span>
            </p>
            <p className="home-featured-banner__place">
              <AppIcon icon={MapPin} size="xs" />
              <span>{location}</span>
            </p>
          </div>
        </div>

        <footer className="home-featured-banner__foot">
          <div
            className="home-featured-banner__metrics"
            aria-label="Event status"
          >
            <div className="home-featured-banner__metric">
              <span className="home-featured-banner__metric-icon" aria-hidden>
                <AppIcon icon={Users} size="xs" />
              </span>
              <span className="home-featured-banner__metric-value">
                {goingLabel}
              </span>
              <span className="home-featured-banner__metric-label">Going</span>
            </div>
            <div className="home-featured-banner__metric">
              <span className="home-featured-banner__metric-icon" aria-hidden>
                <AppIcon icon={Check} size="xs" />
              </span>
              <span className="home-featured-banner__metric-value">
                {rsvpLabel}
              </span>
              <span className="home-featured-banner__metric-label">RSVP</span>
            </div>
          </div>

          <div className="home-featured-banner__actions">
            <Link
              to={eventPath}
              className="home-featured-banner__btn home-featured-banner__btn--primary"
            >
              Open event
              <AppIcon icon={ChevronRight} size="sm" />
            </Link>
            {canManage ? (
              <Link
                to={managePath}
                className="home-featured-banner__btn home-featured-banner__btn--ghost"
              >
                Manage
              </Link>
            ) : (
              <Link
                to="/events/calendar"
                className="home-featured-banner__btn home-featured-banner__btn--ghost"
              >
                Calendar
              </Link>
            )}
          </div>
        </footer>
      </div>

      <div className="home-featured-banner__nav-anchor">
        <FeaturedCarouselControls
          index={safeIndex}
          total={events.length}
          onPrev={goPrev}
          onNext={goNext}
          tone="light"
        />
      </div>
    </section>
  );
}

function FeaturedEventLine({
  event,
  isLoading,
  safeIndex,
  total,
  canCreateEvent,
  onPrev,
  onNext,
}: {
  event: EventResponse | null;
  isLoading: boolean;
  safeIndex: number;
  total: number;
  canCreateEvent: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (isLoading) {
    return (
      <section aria-label="Featured Event" className="home-featured-line is-loading">
        <p className="home-section-kicker">Upcoming event</p>
        <p className="home-featured-line__muted">Loading…</p>
      </section>
    );
  }

  if (!event) {
    return (
      <section aria-label="Featured Event" className="home-featured-line is-empty">
        <p className="home-section-kicker">Upcoming event</p>
        <div className="home-featured-line__row">
          <p className="home-featured-line__muted">No upcoming events</p>
          <div className="home-featured-line__aside">
            {canCreateEvent ? (
              <Link to="/events/calendar?create=1" className="home-featured-line__link">
                Create
              </Link>
            ) : null}
            <Link to="/events/calendar" className="home-featured-line__link">
              View calendar
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const eventPath = eventDetailPath(event.id);
  const when = `${formatEventDateShort(event.starts_at)} · ${formatEventTime(event.starts_at)}`;

  return (
    <section aria-label="Featured Event" className="home-featured-line">
      <div className="home-featured-line__head">
        <p className="home-section-kicker">Upcoming event</p>
        <FeaturedCarouselControls
          index={safeIndex}
          total={total}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>
      <div className="home-featured-line__row">
        <Link to={eventPath} className="home-featured-line__main">
          <span className="home-featured-line__name">{event.name}</span>
          <span className="home-featured-line__sep" aria-hidden>
            ·
          </span>
          <span className="home-featured-line__when">{when}</span>
        </Link>
        <Link to={eventPath} className="home-featured-line__open" aria-label="Open event">
          <AppIcon icon={ChevronRight} size="sm" />
        </Link>
      </div>
    </section>
  );
}

function FeaturedEventStrip({
  event,
  isLoading,
  density,
  contentScale,
  safeIndex,
  total,
  goingCount,
  maybeCount,
  notGoingCount,
  canManage,
  canCreateEvent,
  onPrev,
  onNext,
}: {
  event: EventResponse | null;
  isLoading: boolean;
  density: "xs" | "sm" | "md" | "lg" | "xl";
  contentScale: number;
  safeIndex: number;
  total: number;
  goingCount: number | null;
  maybeCount: number | null;
  notGoingCount: number | null;
  canManage: boolean;
  canCreateEvent: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const fitStyle = {
    ["--featured-scale" as string]: String(contentScale),
  };
  const shellClass = [
    "home-featured home-event-strip home-featured--fit",
    `is-density-${density}`,
  ].join(" ");

  if (isLoading) {
    return (
      <section
        aria-label="Featured Event"
        className={`${shellClass} is-loading`}
        style={fitStyle}
        data-density={density}
      >
        <p className="home-section-kicker">Upcoming event</p>
        <div className="home-event-strip__skeleton" />
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className={`${shellClass} is-empty`}
        style={fitStyle}
        data-density={density}
      >
        <p className="home-section-kicker">Upcoming event</p>
        <div className="home-event-strip__inner home-event-strip__inner--empty">
          <div className="home-event-strip__main">
            <h2 className="home-event-strip__title">No upcoming events</h2>
            <p className="home-event-strip__meta">
              {canCreateEvent
                ? "Create an event to put the next priority here."
                : "Nothing scheduled yet."}
            </p>
          </div>
          <div className="home-event-strip__aside">
            {canCreateEvent ? (
              <Link
                to="/events/calendar?create=1"
                className="home-event-strip__cta"
              >
                Create event
              </Link>
            ) : null}
            <Link to="/events/calendar" className="home-event-strip__cta">
              View calendar
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const eventPath = eventDetailPath(event.id);
  const managePath = `${eventPath}/manage`;
  const countdown = formatCountdownBadge(event.starts_at);
  const location = event.location?.trim() || "Location TBA";
  const dateBlock = getDateBlockParts(event.starts_at);
  const rsvpHealth = computeRsvpHealth({
    going: goingCount,
    maybe: maybeCount,
    notGoing: notGoingCount,
    capacity: event.capacity,
  });

  return (
    <section
      aria-label="Featured Event"
      className={shellClass}
      style={fitStyle}
      data-density={density}
    >
      <div className="home-event-strip__head">
        <p className="home-section-kicker">Upcoming event</p>
        <FeaturedCarouselControls
          index={safeIndex}
          total={total}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>

      <div className="home-event-strip__inner">
        <div className="home-event-strip__date" aria-hidden="true">
          <span className="home-event-strip__date-month">{dateBlock.month}</span>
          <span className="home-event-strip__date-day">{dateBlock.day}</span>
          <span className="home-event-strip__date-weekday">
            {dateBlock.weekday}
          </span>
        </div>

        <div className="home-event-strip__main">
          <h2 className="home-event-strip__title">
            <Link to={eventPath} className="home-event-strip__title-link">
              {event.name}
            </Link>
          </h2>

          <p className="home-event-strip__when">
            <span className="home-event-strip__when-part">
              <AppIcon icon={Calendar} size="xs" />
              {formatEventTime(event.starts_at)}
            </span>
            <span className="home-event-strip__when-sep" aria-hidden>
              ·
            </span>
            <span className="home-event-strip__when-part">
              <AppIcon icon={MapPin} size="xs" />
              {location}
            </span>
          </p>

          <ul className="home-event-strip__stats" aria-label="Event status">
            <li>
              <AppIcon icon={Users} size="xs" />
              <span>
                {goingCount == null ? "—" : goingCount} Going
              </span>
            </li>
            <li>
              <AppIcon icon={Check} size="xs" />
              <span>
                {rsvpHealth == null ? "— RSVP" : `${rsvpHealth}% RSVP`}
              </span>
            </li>
          </ul>
        </div>

        <div className="home-event-strip__aside">
          {canManage ? (
            <Link to={managePath} className="home-event-strip__manage">
              Manage
            </Link>
          ) : null}
          <Link
            to={eventPath}
            className="home-event-strip__countdown"
            aria-label={`Open event · ${countdown}`}
          >
            <span>{countdown}</span>
            <AppIcon icon={ChevronRight} size="sm" />
            <span className="home-sr-only">Open event</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
