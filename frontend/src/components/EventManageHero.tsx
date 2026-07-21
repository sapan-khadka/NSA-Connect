import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CheckSquare,
  ClipboardCheck,
  Copy,
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
import { Link, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api-error";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import {
  combineDateAndTime,
  getMinEventDate,
  splitEventDateTime,
} from "../lib/event-form";
import { eventDetailPath, publicEventPath } from "../lib/event-links";
import {
  EVENT_MANAGE_EYEBROW,
  EVENT_MANAGE_PRIMARY_BTN,
  EVENT_MANAGE_SECTION_CARD_CLASS,
  EVENT_MANAGE_SECONDARY_BTN,
} from "../lib/event-manage-ui";
import {
  duplicateEvent,
  fetchEventAttendees,
  fetchEventVolunteerSignups,
  type EventDetailResponse,
} from "../lib/events-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { formatCountdownBadge } from "../lib/format-datetime";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";
import { Modal } from "./ui/Modal";

type EventManageHeroProps = {
  event: EventDetailResponse;
  budget: FinanceEventBudgetSummary | null;
  tasks: EventTaskResponse[];
  backTo: string;
  onEditEvent: () => void;
  onCheckIn: () => void;
  /** When provided, skips redundant attendee/volunteer fetches. */
  attendeeCount?: number | null;
  volunteerCount?: number | null;
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
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-gray-100 bg-white px-3.5 py-3 transition duration-150 hover:border-gray-200">
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
    EVENT_MANAGE_SECONDARY_BTN,
    "gap-1.5",
    active ? "border-primary/25 bg-badge-teal-bg text-primary hover:bg-badge-teal-bg" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function EventManageHero({
  event,
  budget,
  tasks,
  backTo,
  onEditEvent,
  onCheckIn,
  attendeeCount: attendeeCountProp,
  volunteerCount: volunteerCountProp,
}: EventManageHeroProps) {
  const navigate = useNavigate();
  const metricsProvided =
    attendeeCountProp !== undefined || volunteerCountProp !== undefined;
  const [attendeeCountLocal, setAttendeeCountLocal] = useState<number | null>(
    null,
  );
  const [volunteerCountLocal, setVolunteerCountLocal] = useState<number | null>(
    null,
  );
  const [shareCopied, setShareCopied] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const initialSchedule = splitEventDateTime(event.starts_at);
  const [duplicateName, setDuplicateName] = useState(`${event.name} (Copy)`);
  const [duplicateDate, setDuplicateDate] = useState(initialSchedule.event_date);
  const [duplicateTime, setDuplicateTime] = useState(initialSchedule.event_time);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  useEffect(() => {
    if (metricsProvided) {
      return;
    }

    let cancelled = false;

    void fetchEventAttendees(event.id)
      .then((response) => {
        if (!cancelled) {
          setAttendeeCountLocal(response.going_count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAttendeeCountLocal(null);
        }
      });

    void fetchEventVolunteerSignups(event.id)
      .then((response) => {
        if (!cancelled) {
          setVolunteerCountLocal(response.total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVolunteerCountLocal(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [event.id, metricsProvided]);

  const attendeeCount =
    attendeeCountProp !== undefined ? attendeeCountProp : attendeeCountLocal;
  const volunteerCount =
    volunteerCountProp !== undefined ? volunteerCountProp : volunteerCountLocal;

  const memberPath = eventDetailPath(event.id);
  const canSharePublicly =
    event.event_type !== "meeting" || event.meeting_visibility === "public";
  const sharePath = canSharePublicly ? publicEventPath(event.id) : memberPath;
  const location = event.location?.trim() || "Location TBA";
  const when = formatEventWhen(event.starts_at);
  const countdown = formatCountdownBadge(event.starts_at);
  const lifecycle = eventLifecycleStatus(event);
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const budgetValue = budget
    ? formatCurrency(budget.planned_budget)
    : "—";

  async function handleShare(): Promise<void> {
    const url = `${window.location.origin}${sharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareCopied(false);
    }
  }

  function openDuplicateModal() {
    const next = splitEventDateTime(event.starts_at);
    setDuplicateName(`${event.name} (Copy)`);
    setDuplicateDate(next.event_date);
    setDuplicateTime(next.event_time);
    setDuplicateError(null);
    setDuplicateOpen(true);
  }

  async function handleDuplicate(): Promise<void> {
    if (!duplicateDate || !duplicateTime) {
      setDuplicateError("Date and time are required.");
      return;
    }

    setDuplicating(true);
    setDuplicateError(null);
    try {
      const created = await duplicateEvent(event.id, {
        starts_at: combineDateAndTime(duplicateDate, duplicateTime),
        name: duplicateName.trim() || undefined,
      });
      setDuplicateOpen(false);
      void navigate(`/events/${created.id}/manage`);
    } catch (caught) {
      setDuplicateError(getApiErrorMessage(caught));
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <Card
      as="section"
      padding="none"
      aria-label="Event overview"
      className={`${EVENT_MANAGE_SECTION_CARD_CLASS} px-5 py-5 sm:px-6 sm:py-6`}
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
          <p className={EVENT_MANAGE_EYEBROW}>Actions</p>
          <button
            type="button"
            onClick={onEditEvent}
            className={`${EVENT_MANAGE_PRIMARY_BTN} gap-1.5`}
          >
            <AppIcon icon={Pencil} size="xs" className="text-current" />
            Edit Event
          </button>
          <Link
            to={canSharePublicly ? sharePath : memberPath}
            className={secondaryActionClassName()}
          >
            <AppIcon icon={ExternalLink} size="xs" className="text-gray-500" />
            {canSharePublicly ? "View Public Page" : "View Event Page"}
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
            {shareCopied
              ? "Link copied"
              : canSharePublicly
                ? "Share Public Link"
                : "Copy Member Link"}
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
          <button
            type="button"
            onClick={openDuplicateModal}
            className={secondaryActionClassName()}
          >
            <AppIcon icon={Copy} size="xs" className="text-gray-500" />
            Duplicate Event
          </button>
        </div>
      </div>

      <Modal
        open={duplicateOpen}
        title="Duplicate event"
        onClose={() => {
          if (!duplicating) {
            setDuplicateOpen(false);
          }
        }}
      >
        <p className="text-sm text-gray-600">
          Creates a new event with the same details, volunteer roles, and simple
          tasks. RSVPs and check-ins are not copied.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="duplicate-event-name"
              className="block text-xs font-medium text-gray-500"
            >
              Name
            </label>
            <input
              id="duplicate-event-name"
              type="text"
              value={duplicateName}
              onChange={(changeEvent) =>
                setDuplicateName(changeEvent.target.value)
              }
              className={`${inputFieldClassName} mt-1`}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="duplicate-event-date"
                className="block text-xs font-medium text-gray-500"
              >
                Date
              </label>
              <input
                id="duplicate-event-date"
                type="date"
                min={getMinEventDate()}
                value={duplicateDate}
                onChange={(changeEvent) =>
                  setDuplicateDate(changeEvent.target.value)
                }
                className={`${inputFieldClassName} mt-1`}
              />
            </div>
            <div>
              <label
                htmlFor="duplicate-event-time"
                className="block text-xs font-medium text-gray-500"
              >
                Time
              </label>
              <input
                id="duplicate-event-time"
                type="time"
                value={duplicateTime}
                onChange={(changeEvent) =>
                  setDuplicateTime(changeEvent.target.value)
                }
                className={`${inputFieldClassName} mt-1`}
              />
            </div>
          </div>
          {duplicateError ? (
            <p className="text-sm text-red-700" role="alert">
              {duplicateError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDuplicateOpen(false)}
              disabled={duplicating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleDuplicate()}
              disabled={duplicating}
            >
              {duplicating ? "Duplicating…" : "Create copy"}
            </Button>
          </div>
        </div>
      </Modal>

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
    </Card>
  );
}
