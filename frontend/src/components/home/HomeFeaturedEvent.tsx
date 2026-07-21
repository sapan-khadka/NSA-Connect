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
    <div className={["flex items-center gap-2.5", className].join(" ")}>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, dotIndex) => (
          <span
            key={dotIndex}
            className={[
              "h-1.5 rounded-full transition-all duration-300",
              dotIndex === index
                ? "w-4 bg-white"
                : "w-1.5 bg-white/35",
            ].join(" ")}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous upcoming event"
        onClick={onPrev}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-inset ring-white/20 backdrop-blur-md transition hover:bg-black/50"
      >
        <AppIcon icon={ChevronLeft} size="sm" className="text-current" />
      </button>
      <button
        type="button"
        aria-label="Next upcoming event"
        onClick={onNext}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-inset ring-white/20 backdrop-blur-md transition hover:bg-black/50"
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
        className="overflow-hidden rounded-[1.35rem] border border-gray-200/70 bg-white/60 p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm"
      >
        <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200/80" />
        <div className="mt-5 h-8 w-2/3 max-w-md animate-pulse rounded-lg bg-slate-200/80" />
        <div className="mt-3 h-4 w-48 animate-pulse rounded bg-slate-200/70" />
        <div className="mt-10 flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/80" />
          <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-200/60" />
        </div>
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className="relative overflow-hidden rounded-[1.35rem] border border-dashed border-gray-300/80 bg-gradient-to-br from-white via-white to-badge-teal-bg/40 px-6 py-9 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-2xl"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-label">
          Next event
        </p>
        <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          Nothing upcoming
        </p>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-gray-600">
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
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
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
      className="relative overflow-hidden rounded-[1.35rem] bg-[#07111f] text-white shadow-[0_18px_40px_-28px_rgba(7,17,31,0.85)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[68%_center] opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07111f] via-[#07111f]/92 to-[#07111f]/35 sm:via-[#07111f]/88 sm:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111f]/70 via-transparent to-[#07111f]/25" />
      </div>

      <div className="relative grid min-h-[17rem] grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(10rem,0.95fr)]">
        <div className="relative z-10 flex min-w-0 max-w-xl flex-col gap-4 p-5 sm:p-7 lg:pr-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                Next event
              </p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/85 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
                {countdown}
              </span>
            </div>
            <FeaturedCarouselControls
              index={safeIndex}
              total={events.length}
              onPrev={goPrev}
              onNext={goNext}
              className="lg:hidden"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-[1.65rem] font-semibold tracking-tight text-white sm:text-[1.9rem]">
              {event.name}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-white/70">
              {formatFeaturedWhen(event.starts_at)}
              {event.location?.trim()
                ? ` · ${event.location.trim()}`
                : ""}
            </p>
          </div>

          {goingCount != null ? (
            <p className="text-sm text-white/75">
              <span className="font-semibold text-white">{goingCount}</span>
              <span className="text-white/55"> going</span>
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-1">
            <Link
              to={eventPath}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(15,118,110,0.9)] transition hover:bg-primary-hover"
            >
              Open event
            </Link>
            {canManage ? (
              <Link
                to={managePath}
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/12 hover:text-white"
              >
                Manage
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative hidden min-h-[17rem] lg:block">
          <FeaturedCarouselControls
            index={safeIndex}
            total={events.length}
            onPrev={goPrev}
            onNext={goNext}
            className="absolute bottom-5 right-5 z-20"
          />
        </div>
      </div>
    </section>
  );
}
