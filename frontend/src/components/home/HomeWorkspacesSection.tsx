import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Calendar,
  CircleDollarSign,
  HandHelping,
  MapPin,
  PartyPopper,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import nsaCover from "../../assets/nsa-cover.PNG";
import { EVENT_TYPE_LABELS, type EventType } from "../../lib/event-types";
import { eventDetailPath } from "../../lib/event-links";
import {
  fetchEventAttendees,
  type EventResponse,
} from "../../lib/events-api";
import { formatCountdownBadge } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { EmptyState } from "../ui/EmptyState";
import { ArrowLink } from "../ui/ArrowLink";

const EVENT_CATEGORY_ICON: Record<EventType, LucideIcon> = {
  cultural: Sparkles,
  meeting: Briefcase,
  fundraiser: CircleDollarSign,
  social: PartyPopper,
  service: HandHelping,
};

function formatWorkspaceWhen(isoDate: string): string {
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
  const time = new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(new Date(isoDate));
  return `${date} · ${time}`;
}

type RsvpCounts = {
  going: number;
  maybe: number;
  notGoing: number;
};

function WorkspaceCard({
  event,
  openTaskCount = 0,
}: {
  event: EventResponse;
  openTaskCount?: number;
}) {
  const [counts, setCounts] = useState<RsvpCounts | null>(null);
  const photoUrl = event.event_photo_url?.trim() || null;
  const location = event.location?.trim() || "Location TBA";
  const eventPath = eventDetailPath(event.id);
  const countdown = formatCountdownBadge(event.starts_at);
  const categoryIcon = EVENT_CATEGORY_ICON[event.event_type];
  const needsAttention = openTaskCount > 0;
  const responded =
    counts == null ? 0 : counts.going + counts.maybe + counts.notGoing;

  useEffect(() => {
    let cancelled = false;
    void fetchEventAttendees(event.id)
      .then((response) => {
        if (!cancelled) {
          setCounts({
            going: response.going_count,
            maybe: response.maybe_count,
            notGoing: response.not_going_count,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCounts(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  return (
    <article className="flex w-[min(100%,18.5rem)] shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-200 hover:border-gray-200 hover:shadow-md sm:w-[19.5rem]">
      <div className="relative h-36 shrink-0 overflow-hidden">
        <img
          src={photoUrl ?? nsaCover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent"
        />
        <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          {countdown}
        </span>
        {!photoUrl ? (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white/95">
            <AppIcon icon={categoryIcon} size="xs" className="text-white/90" />
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-3.5">
        <Link
          to={eventPath}
          className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground transition hover:text-primary"
        >
          {event.name}
        </Link>

        <div className="mt-2.5 space-y-1.5">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <AppIcon icon={Calendar} size="xs" className="shrink-0 text-gray-400" />
            <span className="truncate">{formatWorkspaceWhen(event.starts_at)}</span>
          </p>
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <AppIcon icon={MapPin} size="xs" className="shrink-0 text-gray-400" />
            <span className="truncate">{location}</span>
          </p>
        </div>

        {counts ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <AppIcon icon={Users} size="xs" className="text-gray-400" />
                {responded} responded
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-1 text-center">
              <div className="rounded-lg bg-emerald-50/80 px-1.5 py-1.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/80">
                  Going
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-emerald-900">
                  {counts.going}
                </dd>
              </div>
              <div className="rounded-lg bg-amber-50/80 px-1.5 py-1.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-amber-700/80">
                  Maybe
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-amber-900">
                  {counts.maybe}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-1.5 py-1.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  No
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-800">
                  {counts.notGoing}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <p
          className={[
            "mt-3 rounded-lg px-2.5 py-1.5 text-xs font-medium",
            needsAttention
              ? "bg-amber-50 text-amber-900"
              : "bg-emerald-50/90 text-emerald-900",
          ].join(" ")}
        >
          {needsAttention
            ? `${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} need${openTaskCount === 1 ? "s" : ""} attention`
            : "All good"}
        </p>

        <div className="mt-auto pt-3">
          <Link
            to={eventPath}
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
          >
            Open Workspace
          </Link>
        </div>
      </div>
    </article>
  );
}

export function HomeWorkspacesSection({
  events,
  isLoading,
  openTaskCountByEventId = {},
}: {
  events: EventResponse[];
  isLoading: boolean;
  openTaskCountByEventId?: Record<number, number>;
}) {
  return (
    <section aria-label="Your Workspaces" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="home-section-title text-base font-semibold">
          Your Workspaces
        </h2>
        <ArrowLink to="/events/calendar">View calendar</ArrowLink>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading workspaces…</p>
      ) : null}

      {!isLoading && events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6">
          <EmptyState
            icon="calendar"
            title="No upcoming workspaces"
            description="When events are scheduled, they’ll show up here."
          />
        </div>
      ) : null}

      {!isLoading && events.length > 0 ? (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {events.map((event) => (
            <WorkspaceCard
              key={event.id}
              event={event}
              openTaskCount={openTaskCountByEventId[event.id] ?? 0}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
