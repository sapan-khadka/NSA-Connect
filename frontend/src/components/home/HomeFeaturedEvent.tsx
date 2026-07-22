import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import nsaCover from "../../assets/nsa-cover.PNG";
import { eventDetailPath } from "../../lib/event-links";
import { fetchEventTasks } from "../../lib/event-tasks-api";
import {
  fetchEventAttendees,
  type EventResponse,
} from "../../lib/events-api";
import { formatCountdownBadge } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";

function formatFeaturedWhen(isoDate: string): string {
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
  return `${date} · ${time}`;
}

function FeaturedCarouselControls({
  index,
  total,
  onPrev,
  onNext,
  className = "",
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  if (total <= 1) {
    return null;
  }

  return (
    <div className={["flex items-center gap-2.5", className].join(" ")}>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, dotIndex) => (
          <span
            key={dotIndex}
            className={[
              "h-1.5 rounded-full transition-all duration-300",
              dotIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/35",
            ].join(" ")}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous upcoming event"
        onClick={onPrev}
        className="home-featured-nav-btn"
      >
        <AppIcon icon={ChevronLeft} size="sm" className="text-current" />
      </button>
      <button
        type="button"
        aria-label="Next upcoming event"
        onClick={onNext}
        className="home-featured-nav-btn"
      >
        <AppIcon icon={ChevronRight} size="sm" className="text-current" />
      </button>
    </div>
  );
}

export function HomeFeaturedEvent({
  events,
  canManage = false,
  canCreateEvent = false,
  isLoading,
}: {
  events: EventResponse[];
  openTaskCountByEventId?: Record<number, number>;
  canManage?: boolean;
  canCreateEvent?: boolean;
  isLoading: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [maybeCount, setMaybeCount] = useState<number | null>(null);
  const [prepPercent, setPrepPercent] = useState<number | null>(null);

  const safeIndex = events.length === 0 ? 0 : Math.min(index, events.length - 1);
  const event = events[safeIndex] ?? null;
  const eventIdsKey = events.map((item) => item.id).join(",");

  useEffect(() => {
    setIndex(0);
  }, [eventIdsKey]);

  useEffect(() => {
    if (!event) {
      setGoingCount(null);
      setMaybeCount(null);
      setPrepPercent(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      fetchEventAttendees(event.id),
      fetchEventTasks(event.id).catch(() => null),
    ])
      .then(([attendees, tasksResponse]) => {
        if (cancelled) {
          return;
        }
        setGoingCount(attendees.going_count);
        setMaybeCount(attendees.maybe_count);
        if (tasksResponse && tasksResponse.tasks.length > 0) {
          const done = tasksResponse.tasks.filter(
            (task) => task.is_complete || task.status === "done",
          ).length;
          setPrepPercent(Math.round((done / tasksResponse.tasks.length) * 100));
        } else {
          setPrepPercent(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoingCount(null);
          setMaybeCount(null);
          setPrepPercent(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [event?.id]);

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

  if (isLoading) {
    return (
      <section
        aria-label="Featured Event"
        className="home-featured home-featured--loading"
      >
        <div className="home-featured-info">
          <div className="h-3 w-28 animate-pulse rounded-full bg-white/15" />
          <div className="mt-5 h-8 w-2/3 max-w-md animate-pulse rounded-lg bg-white/15" />
          <div className="mt-4 h-4 w-56 animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-white/10" />
        </div>
        <div className="home-featured-media home-featured-media--skeleton" />
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className="home-featured home-featured--empty"
      >
        <div className="home-featured-info">
          <p className="home-featured-eyebrow">Upcoming event</p>
          <h2 className="home-featured-title">Nothing upcoming</h2>
          <p className="home-featured-meta-line">
            {canCreateEvent
              ? "Create the next event when you’re ready to plan."
              : "Check the calendar for later dates."}
          </p>
          <div className="home-featured-actions">
            <Link
              to={
                canCreateEvent
                  ? "/events/calendar?create=1"
                  : "/events/calendar"
              }
              className="home-featured-btn home-featured-btn--primary"
            >
              {canCreateEvent ? "Create event" : "View calendar"}
            </Link>
          </div>
        </div>
        <div className="home-featured-media">
          <img src={nsaCover} alt="" className="home-featured-photo" />
          <div className="home-featured-fade" aria-hidden="true" />
        </div>
      </section>
    );
  }

  const photoUrl = event.event_photo_url?.trim() || nsaCover;
  const eventPath = eventDetailPath(event.id);
  const managePath = `${eventPath}/manage`;
  const countdown = formatCountdownBadge(event.starts_at);
  const location = event.location?.trim() || "Location TBA";

  return (
    <section aria-label="Featured Event" className="home-featured">
      <div className="home-featured-info">
        <div className="home-featured-info-top">
          <div className="flex flex-wrap items-center gap-2">
            <p className="home-featured-eyebrow">Upcoming event</p>
            <span className="home-featured-countdown">{countdown}</span>
          </div>
          <FeaturedCarouselControls
            index={safeIndex}
            total={events.length}
            onPrev={goPrev}
            onNext={goNext}
            className="lg:hidden"
          />
        </div>

        <h2 className="home-featured-title">{event.name}</h2>

        <ul className="home-featured-meta-list">
          <li>
            <AppIcon icon={Calendar} size="xs" className="text-white/45" />
            <span>{formatFeaturedWhen(event.starts_at)}</span>
          </li>
          <li>
            <AppIcon icon={MapPin} size="xs" className="text-white/45" />
            <span>{location}</span>
          </li>
        </ul>

        <div className="home-featured-stats">
          <div className="home-featured-rsvp">
            <div>
              <p className="home-featured-rsvp-value">
                {goingCount == null ? "—" : goingCount}
              </p>
              <p className="home-featured-rsvp-label">Going</p>
            </div>
            <div>
              <p className="home-featured-rsvp-value">
                {maybeCount == null ? "—" : maybeCount}
              </p>
              <p className="home-featured-rsvp-label">Maybe</p>
            </div>
          </div>
          <div className="home-featured-prep">
            <div className="home-featured-prep-head">
              <span>Preparation</span>
              <span>{prepPercent == null ? "—" : `${prepPercent}%`}</span>
            </div>
            <div
              className="home-featured-prep-track"
              role="progressbar"
              aria-label="Event preparation"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={prepPercent ?? 0}
            >
              <span
                className="home-featured-prep-fill"
                style={{ width: `${prepPercent ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="home-featured-actions">
          <Link
            to={eventPath}
            className="home-featured-btn home-featured-btn--primary"
          >
            Open event
          </Link>
          {canManage ? (
            <Link
              to={managePath}
              className="home-featured-btn home-featured-btn--ghost"
            >
              Manage
            </Link>
          ) : null}
        </div>
      </div>

      <div className="home-featured-media">
        <img src={photoUrl} alt="" className="home-featured-photo" />
        <div className="home-featured-fade" aria-hidden="true" />
        <div className="home-featured-media-footer">
          <FeaturedCarouselControls
            index={safeIndex}
            total={events.length}
            onPrev={goPrev}
            onNext={goNext}
            className="home-featured-controls-desktop"
          />
        </div>
      </div>
    </section>
  );
}
