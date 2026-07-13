import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CheckSquare,
  ClipboardCheck,
  ExternalLink,
  ListTodo,
  MapPin,
  Pencil,
  Share2,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { eventDetailPath } from "../lib/event-links";
import {
  fetchEventAttendees,
  fetchEventVolunteerSignups,
  type EventDetailResponse,
} from "../lib/events-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { AppIcon } from "./ui/AppIcon";

type EventManageHeroProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  tasks: EventTaskResponse[];
  backTo: string;
  onEditEvent: () => void;
  onCheckIn: () => void;
};

function formatEventWhen(isoDate: string): string {
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
  const time = new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(new Date(isoDate));
  return `${date} • ${time}`;
}

function formatCountdownBadge(isoDate: string, now = new Date()): string {
  const start = new Date(isoDate).getTime();
  const diffMs = start - now.getTime();

  if (!Number.isFinite(diffMs)) {
    return "Soon";
  }
  if (diffMs <= 0) {
    return "Happening now";
  }

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);

  if (days > 1) {
    return `${days} days left`;
  }
  if (days === 1) {
    return "Tomorrow";
  }
  if (hours >= 1) {
    return `${hours} hr left`;
  }

  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return `${minutes} min left`;
}

function eventLifecycleStatus(event: EventDetailResponse): {
  label: "Completed" | "Published";
  className: string;
} {
  if (event.is_past) {
    return {
      label: "Completed",
      className: "bg-gray-100 text-gray-700 ring-gray-200/80",
    };
  }
  return {
    label: "Published",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-100/80",
  };
}

function HeroMetric({
  icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-gray-100 bg-white/80 px-3.5 py-3 transition duration-150 hover:border-gray-200">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
        <AppIcon icon={icon} size="sm" className="text-current" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
          {value}
        </p>
        <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function secondaryActionClassName(active = false): string {
  return [
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2",
    active
      ? "border-primary/25 bg-badge-teal-bg text-primary"
      : "border-gray-200 bg-white text-foreground hover:border-gray-300 hover:bg-gray-50",
  ].join(" ");
}

export function EventManageHero({
  event,
  budget,
  tasks,
  backTo,
  onEditEvent,
  onCheckIn,
}: EventManageHeroProps) {
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [volunteerCount, setVolunteerCount] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchEventAttendees(event.id)
      .then((response) => {
        if (!cancelled) {
          setAttendeeCount(response.going_count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAttendeeCount(null);
        }
      });

    void fetchEventVolunteerSignups(event.id)
      .then((response) => {
        if (!cancelled) {
          setVolunteerCount(response.total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVolunteerCount(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const publicPath = eventDetailPath(event.id);
  const location = event.location?.trim() || "Location TBA";
  const when = formatEventWhen(event.starts_at);
  const countdown = formatCountdownBadge(event.starts_at);
  const lifecycle = eventLifecycleStatus(event);
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const budgetValue = budget
    ? formatCurrency(budget.planned_budget)
    : "—";

  async function handleShare(): Promise<void> {
    const url = `${window.location.origin}${publicPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareCopied(false);
    }
  }

  return (
    <section
      aria-label="Event overview"
      className="rounded-2xl border border-gray-100 bg-white px-5 py-5 shadow-none sm:px-6 sm:py-6"
    >
      <Link
        to={backTo}
        className="inline-flex items-center text-sm font-medium text-gray-500 transition duration-150 hover:text-primary"
      >
        ← Back to Events
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18.5rem)] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
            >
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${lifecycle.className}`}
            >
              {lifecycle.label}
            </span>
          </div>

          <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
            {event.name}
          </h1>

          <div className="mt-5 space-y-3">
            <p className="flex items-start gap-2.5 text-[15px] leading-snug text-foreground">
              <AppIcon
                icon={Calendar}
                size="xs"
                className="mt-0.5 shrink-0 text-gray-400"
              />
              <span>{when}</span>
            </p>
            <p className="flex items-start gap-2.5 text-sm leading-snug text-gray-600">
              <AppIcon
                icon={MapPin}
                size="xs"
                className="mt-0.5 shrink-0 text-gray-400"
              />
              <span>{location}</span>
            </p>
            <p className="flex items-start gap-2.5 text-sm leading-snug text-gray-600">
              <AppIcon
                icon={Users}
                size="xs"
                className="mt-0.5 shrink-0 text-gray-400"
              />
              <span>
                {attendeeCount === null
                  ? "Loading attendees…"
                  : attendeeCount === 1
                    ? "1 attending"
                    : `${attendeeCount} attending`}
              </span>
            </p>
            {!event.is_past ? (
              <p className="pt-0.5">
                <span className="inline-flex items-center rounded-full bg-amber-50/90 px-2.5 py-0.5 text-[11px] font-medium text-amber-800/90 ring-1 ring-inset ring-amber-100/70">
                  {countdown}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:items-stretch">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
            Actions
          </p>
          <button
            type="button"
            onClick={onEditEvent}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-white transition duration-150 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
          >
            <AppIcon icon={Pencil} size="xs" className="text-current" />
            Edit Event
          </button>
          <Link to={publicPath} className={secondaryActionClassName()}>
            <AppIcon icon={ExternalLink} size="xs" className="text-gray-500" />
            View Public Page
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleShare();
            }}
            className={secondaryActionClassName(shareCopied)}
            aria-live="polite"
          >
            <AppIcon icon={Share2} size="xs" className="text-current" />
            {shareCopied ? "Link copied" : "Share Event"}
          </button>
          <button
            type="button"
            onClick={onCheckIn}
            className={secondaryActionClassName()}
          >
            <AppIcon
              icon={ClipboardCheck}
              size="xs"
              className="text-gray-500"
            />
            Check In
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-gray-100 pt-6 sm:grid-cols-4">
        <HeroMetric
          icon={Users}
          value={attendeeCount === null ? "—" : String(attendeeCount)}
          label="Attendees"
        />
        <HeroMetric icon={Wallet} value={budgetValue} label="Budget" />
        <HeroMetric
          icon={UserPlus}
          value={volunteerCount === null ? "—" : String(volunteerCount)}
          label="Volunteers"
        />
        <HeroMetric
          icon={openTasks > 0 ? ListTodo : CheckSquare}
          value={String(tasks.length)}
          label="Tasks"
        />
      </div>
    </section>
  );
}
