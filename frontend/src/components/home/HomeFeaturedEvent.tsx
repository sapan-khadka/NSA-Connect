import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import nsaCover from "../../assets/nsa-cover.PNG";
import { eventDetailPath } from "../../lib/event-links";
import {
  fetchEventAttendees,
  type EventResponse,
} from "../../lib/events-api";
import { formatCountdownBadge } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";

function formatFeaturedWhen(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
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
    <div className={["flex items-center gap-2", className].join(" ")}>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, dotIndex) => (
          <span
            key={dotIndex}
            className={[
              "h-1.5 w-1.5 rounded-full transition",
              dotIndex === index ? "bg-white" : "bg-white/35",
            ].join(" ")}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous upcoming event"
        onClick={onPrev}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm transition hover:bg-black/55"
      >
        <AppIcon icon={ChevronLeft} size="sm" className="text-current" />
      </button>
      <button
        type="button"
        aria-label="Next upcoming event"
        onClick={onNext}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-inset ring-white/15 backdrop-blur-sm transition hover:bg-black/55"
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

  const safeIndex = events.length === 0 ? 0 : Math.min(index, events.length - 1);
  const event = events[safeIndex] ?? null;
  const eventIdsKey = events.map((item) => item.id).join(",");

  useEffect(() => {
    setIndex(0);
  }, [eventIdsKey]);

  useEffect(() => {
    if (!event) {
      setGoingCount(null);
      return;
    }

    let cancelled = false;
    void fetchEventAttendees(event.id)
      .then((attendees) => {
        if (!cancelled) {
          setGoingCount(attendees.going_count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoingCount(null);
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
        className="overflow-hidden rounded-2xl bg-slate-900/5 p-6"
      >
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200/80" />
        <div className="mt-4 h-7 w-2/3 max-w-md animate-pulse rounded bg-slate-200/80" />
        <div className="mt-3 h-4 w-40 animate-pulse rounded bg-slate-200/70" />
        <div className="mt-8 h-9 w-36 animate-pulse rounded-lg bg-slate-200/80" />
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className="overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-white/70 px-6 py-8"
      >
        <p className="text-sm font-medium text-foreground">Nothing upcoming</p>
        <p className="mt-1 max-w-sm text-sm text-gray-600">
          {canCreateEvent
            ? "Create the next event when you’re ready to plan."
            : "Check the calendar for later dates."}
        </p>
        <Link
          to={
            canCreateEvent
              ? "/events/calendar?create=1"
              : "/events/calendar"
          }
          className="mt-5 inline-flex text-sm font-medium text-primary hover:text-primary-hover"
        >
          {canCreateEvent ? "Create event" : "View calendar"}
        </Link>
      </section>
    );
  }

  const photoUrl = event.event_photo_url?.trim() || nsaCover;
  const eventPath = eventDetailPath(event.id);
  const managePath = `${eventPath}/manage`;
  const countdown = formatCountdownBadge(event.starts_at);

  return (
    <section
      aria-label="Featured Event"
      className="relative overflow-hidden rounded-2xl bg-[#0b1220] text-white shadow-sm"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[58%] min-w-[12rem] sm:w-[60%]"
      >
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[68%_center]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #0b1220 0%, #0b1220 14%, rgba(11,18,32,0.88) 36%, rgba(11,18,32,0.4) 62%, rgba(11,18,32,0.1) 82%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative grid min-h-[14rem] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,0.9fr)]">
        <div className="relative z-10 flex min-w-0 max-w-xl flex-col gap-3 p-5 sm:p-6 lg:pr-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Next event
            </p>
            <FeaturedCarouselControls
              index={safeIndex}
              total={events.length}
              onPrev={goPrev}
              onNext={goNext}
              className="lg:hidden"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              {event.name}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              {formatFeaturedWhen(event.starts_at)}
              {event.location?.trim()
                ? ` · ${event.location.trim()}`
                : ""}
            </p>
          </div>

          <p className="text-sm text-white/80">
            <span className="font-medium text-white">{countdown}</span>
            {goingCount != null ? (
              <span className="text-white/60">
                {" "}
                · {goingCount} going
              </span>
            ) : null}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            <Link
              to={eventPath}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
            >
              Open event
            </Link>
            {canManage ? (
              <Link
                to={managePath}
                className="inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
              >
                Manage
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative hidden min-h-[14rem] lg:block">
          <FeaturedCarouselControls
            index={safeIndex}
            total={events.length}
            onPrev={goPrev}
            onNext={goNext}
            className="absolute bottom-4 right-4 z-20"
          />
        </div>
      </div>
    </section>
  );
}
