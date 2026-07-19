import { ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import nsaCover from "../../assets/nsa-cover.PNG";
import { eventDetailPath } from "../../lib/event-links";
import {
  fetchEventAttendees,
  fetchEventVolunteerSignups,
  type EventResponse,
} from "../../lib/events-api";
import { formatCurrency } from "../../lib/format-currency";
import { AppIcon } from "../ui/AppIcon";

type FeaturedStats = {
  goingCount: number;
  maybeCount: number;
  notGoingCount: number;
  noResponseCount: number;
  volunteerCount: number;
};

function daysLeft(isoDate: string, now = new Date()): number {
  const start = new Date(isoDate).getTime();
  const diffMs = start - now.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(diffMs / 86_400_000));
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
              dotIndex === index ? "bg-primary" : "bg-white/40",
            ].join(" ")}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous upcoming event"
        onClick={onPrev}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm transition hover:bg-black/60"
      >
        <AppIcon icon={ChevronLeft} size="sm" className="text-current" />
      </button>
      <button
        type="button"
        aria-label="Next upcoming event"
        onClick={onNext}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm transition hover:bg-black/60"
      >
        <AppIcon icon={ChevronRight} size="sm" className="text-current" />
      </button>
    </div>
  );
}

export function HomeFeaturedEvent({
  events,
  openTaskCountByEventId = {},
  canManage = false,
  isLoading,
}: {
  events: EventResponse[];
  openTaskCountByEventId?: Record<number, number>;
  canManage?: boolean;
  isLoading: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<FeaturedStats | null>(null);

  const safeIndex = events.length === 0 ? 0 : Math.min(index, events.length - 1);
  const event = events[safeIndex] ?? null;

  const eventIdsKey = events.map((item) => item.id).join(",");

  useEffect(() => {
    setIndex(0);
  }, [eventIdsKey]);

  useEffect(() => {
    if (!event) {
      setStats(null);
      return;
    }

    let cancelled = false;
    const eventId = event.id;

    void Promise.all([
      fetchEventAttendees(eventId).catch(() => null),
      fetchEventVolunteerSignups(eventId).catch(() => null),
    ]).then(([attendees, volunteers]) => {
      if (cancelled) {
        return;
      }
      if (!attendees) {
        setStats(null);
        return;
      }
      setStats({
        goingCount: attendees.going_count,
        maybeCount: attendees.maybe_count,
        notGoingCount: attendees.not_going_count,
        noResponseCount: attendees.no_response_count,
        volunteerCount: volunteers?.total ?? 0,
      });
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
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <p className="text-sm text-gray-600">Loading featured event…</p>
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className="overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-white p-6 shadow-sm"
      >
        <p className="text-sm font-medium text-foreground">No featured event</p>
        <p className="mt-1 text-sm text-gray-600">
          Schedule an upcoming event to pin it here.
        </p>
        <Link
          to="/events/calendar?create=1"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:text-primary-hover"
        >
          Create event
        </Link>
      </section>
    );
  }

  const photoUrl = event.event_photo_url?.trim() || nsaCover;
  const eventPath = eventDetailPath(event.id);
  const managePath = `${eventPath}/manage`;
  const remainingDays = daysLeft(event.starts_at);
  const openTasks = openTaskCountByEventId[event.id] ?? 0;
  const rsvpTotal = stats
    ? stats.goingCount +
      stats.maybeCount +
      stats.notGoingCount +
      stats.noResponseCount
    : 0;
  const progress =
    stats && rsvpTotal > 0
      ? Math.round((stats.goingCount / rsvpTotal) * 100)
      : 0;
  const description =
    event.description?.trim() ||
    "Open the workspace to review RSVPs, tasks, and logistics.";

  return (
    <section
      aria-label="Featured Event"
      className="relative overflow-hidden rounded-xl bg-[#0b1220] text-white shadow-sm"
    >
      {/*
        Photo sits on the right ~58% of the card. Vignette softens from
        mid-card so the clear focus lands middle-right, not only the far edge.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[58%] min-w-[12rem] sm:w-[60%] lg:w-[58%]"
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
              "linear-gradient(90deg, #0b1220 0%, #0b1220 12%, rgba(11,18,32,0.88) 32%, rgba(11,18,32,0.45) 58%, rgba(11,18,32,0.12) 78%, transparent 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220]/35 via-transparent to-[#0b1220]/15" />
      </div>

      <div className="relative grid min-h-[13.5rem] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,0.95fr)]">
        <div className="relative z-10 flex min-w-0 max-w-xl flex-col gap-2.5 p-3.5 sm:p-4 lg:pr-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-300">
              Featured Event
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
            <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              {event.name}
            </h2>
            <p className="mt-1 line-clamp-1 text-xs leading-snug text-white/65">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/10">
              <AppIcon icon={Timer} size="xs" className="text-white/70" />
              <p className="mt-0.5 text-base font-semibold tabular-nums leading-none text-white">
                {remainingDays}
              </p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-white/60">
                Days left
              </p>
            </div>

            <div className="min-w-0 flex-1 pb-0.5">
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-white/75">
                <span>Overall Progress</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <div className="rounded-lg bg-white/10 px-2 py-1.5 ring-1 ring-inset ring-white/10">
              <dt className="text-[10px] font-medium text-teal-300">Budget</dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-white">
                {formatCurrency(event.budget)}
              </dd>
            </div>
            <div className="rounded-lg bg-white/10 px-2 py-1.5 ring-1 ring-inset ring-white/10">
              <dt className="text-[10px] font-medium text-teal-300">RSVPs</dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-white">
                {stats
                  ? `${stats.goingCount}${rsvpTotal > 0 ? ` / ${rsvpTotal}` : ""}`
                  : "—"}
              </dd>
            </div>
            <div className="rounded-lg bg-white/10 px-2 py-1.5 ring-1 ring-inset ring-white/10">
              <dt className="text-[10px] font-medium text-teal-300">Volunteers</dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-white">
                {stats ? stats.volunteerCount : "—"}
              </dd>
            </div>
            <div className="rounded-lg bg-white/10 px-2 py-1.5 ring-1 ring-inset ring-white/10">
              <dt className="text-[10px] font-medium text-teal-300">Tasks</dt>
              <dd className="mt-0.5 text-xs font-semibold tabular-nums text-white">
                {openTasks}
              </dd>
            </div>
          </dl>

          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">
            <Link
              to={eventPath}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-hover"
            >
              Open Workspace →
            </Link>
            {canManage ? (
              <Link
                to={managePath}
                className="inline-flex items-center justify-center rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
              >
                Manage Event
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative hidden min-h-[13.5rem] lg:block">
          <FeaturedCarouselControls
            index={safeIndex}
            total={events.length}
            onPrev={goPrev}
            onNext={goNext}
            className="absolute bottom-3 right-3 z-20"
          />
        </div>
      </div>
    </section>
  );
}
