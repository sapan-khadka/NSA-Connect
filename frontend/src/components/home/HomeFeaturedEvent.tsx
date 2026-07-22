import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import nsaCover from "../../assets/nsa-cover.PNG";
import { Avatar } from "../../design-system/components/Avatar";
import { eventDetailPath } from "../../lib/event-links";
import {
  fetchEventAttendees,
  type EventResponse,
  type EventRsvpAttendee,
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
  canManage?: boolean;
  canCreateEvent?: boolean;
  isLoading: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [maybeCount, setMaybeCount] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<EventRsvpAttendee[]>([]);

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
      setAttendees([]);
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
        setAttendees(
          response.attendees.filter((row) => row.rsvp_status === "going"),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setGoingCount(null);
          setMaybeCount(null);
          setAttendees([]);
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
        className="home-featured home-featured--hero home-featured--loading"
      >
        <div className="home-featured-hero-skeleton" />
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className="home-featured home-featured--hero home-featured--empty"
      >
        <img src={nsaCover} alt="" className="home-featured-photo" />
        <div className="home-featured-hero-scrim" aria-hidden="true" />
        <div className="home-featured-hero-content">
          <p className="home-featured-eyebrow">Upcoming event</p>
          <h2 className="home-featured-title">Nothing upcoming</h2>
          <p className="home-featured-meta-line">
            {canCreateEvent
              ? "Create the next event when you’re ready to plan."
              : "Check the calendar for later dates."}
          </p>
          <div className="home-featured-hero-footer">
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
      </section>
    );
  }

  const photoUrl = event.event_photo_url?.trim() || nsaCover;
  const eventPath = eventDetailPath(event.id);
  const managePath = `${eventPath}/manage`;
  const countdown = formatCountdownBadge(event.starts_at);
  const location = event.location?.trim() || "Location TBA";
  const visibleAttendees = attendees.slice(0, 4);
  const overflow = Math.max(0, (goingCount ?? 0) - visibleAttendees.length);

  return (
    <section aria-label="Featured Event" className="home-featured home-featured--hero">
      <img src={photoUrl} alt="" className="home-featured-photo" />
      <div className="home-featured-hero-scrim" aria-hidden="true" />

      <div className="home-featured-hero-content">
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
          />
        </div>

        <h2 className="home-featured-title">{event.name}</h2>

        <ul className="home-featured-meta-list">
          <li>
            <AppIcon icon={Calendar} size="xs" className="text-white/55" />
            <span>{formatFeaturedWhen(event.starts_at)}</span>
          </li>
          <li>
            <AppIcon icon={MapPin} size="xs" className="text-white/55" />
            <span>{location}</span>
          </li>
        </ul>

        <div className="home-featured-hero-footer">
          <div className="home-featured-people">
            {visibleAttendees.length > 0 ? (
              <div className="home-featured-avatars" aria-hidden="true">
                {visibleAttendees.map((person, avatarIndex) => (
                  <span
                    key={person.member_id}
                    className="home-featured-avatar"
                    style={{ zIndex: visibleAttendees.length - avatarIndex }}
                  >
                    <Avatar
                      name={person.full_name}
                      size="sm"
                      className="h-7 w-7 text-[10px]"
                    />
                  </span>
                ))}
                {overflow > 0 ? (
                  <span className="home-featured-avatar-more">+{overflow}</span>
                ) : null}
              </div>
            ) : null}
            <p className="home-featured-going">
              <span>{goingCount ?? "—"}</span> Going
              <span className="home-featured-going-sep">·</span>
              <span>{maybeCount ?? "—"}</span> Maybe
            </p>
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
      </div>
    </section>
  );
}
