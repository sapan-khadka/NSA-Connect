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
import {
  EVENT_TYPE_LABELS,
  type EventType,
} from "../../lib/event-types";
import { eventDetailPath } from "../../lib/event-links";
import {
  fetchEventAttendees,
  type EventRsvpAttendee,
  type EventResponse,
  type RsvpStatus,
} from "../../lib/events-api";
import { EventRsvpButton } from "../EventRsvpButton";
import { AppIcon } from "../ui/AppIcon";
import { EmptyState } from "../ui/EmptyState";
import { HomeCard } from "../ui/HomeCard";

function formatUpcomingEventWhen(isoDate: string): string {
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
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

const EVENT_CATEGORY_ICON: Record<EventType, LucideIcon> = {
  cultural: Sparkles,
  meeting: Briefcase,
  fundraiser: CircleDollarSign,
  social: PartyPopper,
  service: HandHelping,
};

type EventStatusBadge = {
  label: string;
  toneClass: string;
};

/** Single highest-priority status chip derived from existing event fields. */
function pickEventStatusBadge(
  event: EventResponse,
  now = new Date(),
): EventStatusBadge | null {
  if (event.is_past) {
    return null;
  }

  const startsInMs = new Date(event.starts_at).getTime() - now.getTime();
  if (Number.isFinite(startsInMs) && startsInMs > 0 && startsInMs <= 3 * 3_600_000) {
    return {
      label: "Starting soon",
      toneClass: "bg-amber-50 text-amber-800 ring-amber-100/80",
    };
  }

  if (!event.current_member_rsvp_status) {
    return {
      label: "RSVP Open",
      toneClass: "bg-emerald-50 text-emerald-800 ring-emerald-100/80",
    };
  }

  return null;
}

function attendeeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function UpcomingEventCover({ event }: { event: EventResponse }) {
  const categoryIcon = EVENT_CATEGORY_ICON[event.event_type];
  const photoUrl = event.event_photo_url?.trim() || null;

  if (photoUrl) {
    return (
      <div className="group/cover relative h-40 w-full shrink-0 overflow-hidden sm:h-44 md:h-auto md:w-[38%] md:min-h-[15.5rem]">
        <img
          src={photoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 ease-out group-hover/cover:scale-[1.02]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-black/5"
        />
      </div>
    );
  }

  // Org cover with a calm category cue — avoids oversized initials placeholders.
  return (
    <div className="group/cover relative h-40 w-full shrink-0 overflow-hidden sm:h-44 md:h-auto md:w-[38%] md:min-h-[15.5rem]">
      <img
        src={nsaCover}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center transition duration-200 ease-out group-hover/cover:scale-[1.02]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/20 to-black/10"
      />
      <div className="absolute inset-0 flex items-end p-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white/95">
          <AppIcon icon={categoryIcon} size="xs" className="text-white/90" />
          {EVENT_TYPE_LABELS[event.event_type]}
        </span>
      </div>
    </div>
  );
}

export function HomeUpNextSection({
  nextEvent,
  isLoading,
  rsvpLoading,
  onRsvpStatusChange,
}: {
  nextEvent: EventResponse | null;
  isLoading: boolean;
  rsvpLoading: boolean;
  onRsvpStatusChange: (status: RsvpStatus) => void;
}) {
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const [goingAttendees, setGoingAttendees] = useState<EventRsvpAttendee[]>([]);

  useEffect(() => {
    if (!nextEvent) {
      setGoingCount(null);
      setGoingAttendees([]);
      return;
    }

    const eventId = nextEvent.id;
    let cancelled = false;

    void fetchEventAttendees(eventId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setGoingCount(response.going_count);
        setGoingAttendees(
          response.attendees.filter((attendee) => attendee.rsvp_status === "going"),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setGoingCount(null);
          setGoingAttendees([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nextEvent?.id]);

  if (isLoading) {
    return (
      <HomeCard
        padding="sm"
        className="flex h-full min-h-0 flex-col home-surface-quiet"
      >
        <h2 className="home-section-title">Upcoming Event</h2>
        <p className="mt-2 text-sm font-normal text-gray-600">Loading events…</p>
      </HomeCard>
    );
  }

  if (!nextEvent) {
    return (
      <HomeCard
        padding="sm"
        className="flex h-full min-h-0 flex-col home-surface-quiet"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="home-section-title">Upcoming Event</h2>
          <Link
            to="/events/calendar"
            className="text-sm font-medium text-primary transition duration-150 hover:text-primary-hover"
          >
            View calendar
          </Link>
        </div>
        <EmptyState
          icon="calendar"
          title="No upcoming events"
          description="Check the calendar for the next festival or social."
        />
      </HomeCard>
    );
  }

  const eventPath = eventDetailPath(nextEvent.id);
  const location = nextEvent.location?.trim() || "Location TBA";
  const countdown = formatCountdownBadge(nextEvent.starts_at);
  const when = formatUpcomingEventWhen(nextEvent.starts_at);
  const statusBadge = pickEventStatusBadge(nextEvent);
  const previewAttendees = goingAttendees.slice(0, 4);
  const extraGoing = Math.max(0, (goingCount ?? 0) - previewAttendees.length);
  const attendanceLabel =
    goingCount === null
      ? null
      : goingCount === 1
        ? "1 attending"
        : `${goingCount} attending`;

  return (
    <section
      aria-label="Upcoming Event"
      className="group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-none transition duration-200 ease-out hover:border-gray-200 md:flex-row"
    >
      <UpcomingEventCover event={nextEvent} />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={eventPath}
            className="min-w-0 flex-1 text-[1.5rem] font-semibold leading-snug tracking-tight text-foreground transition duration-150 ease-out hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 sm:text-[1.625rem]"
          >
            {nextEvent.name}
          </Link>
          <span className="mt-1 inline-flex shrink-0 items-center rounded-full bg-amber-50/90 px-2 py-0.5 text-[11px] font-medium leading-5 text-amber-800/90 ring-1 ring-inset ring-amber-100/70">
            {countdown}
          </span>
        </div>

        {statusBadge ? (
          <span
            className={`mt-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusBadge.toneClass}`}
          >
            {statusBadge.label}
          </span>
        ) : null}

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

          {attendanceLabel ? (
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              {previewAttendees.length > 0 ? (
                <ul className="flex items-center" aria-label={attendanceLabel}>
                  {previewAttendees.map((attendee, index) => (
                    <li
                      key={attendee.member_id}
                      title={attendee.full_name}
                      className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-badge-teal-bg text-[10px] font-semibold text-primary transition duration-150 ease-out hover:z-10 hover:scale-105"
                      style={{
                        marginLeft: index === 0 ? 0 : -8,
                        zIndex: previewAttendees.length - index,
                      }}
                    >
                      <span className="sr-only">{attendee.full_name}</span>
                      <span aria-hidden="true">
                        {attendeeInitials(attendee.full_name)}
                      </span>
                    </li>
                  ))}
                  {extraGoing > 0 ? (
                    <li
                      className="relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-semibold text-gray-600"
                      style={{ marginLeft: -8, zIndex: 0 }}
                      aria-label={`${extraGoing} more attending`}
                    >
                      +{extraGoing}
                    </li>
                  ) : null}
                </ul>
              ) : (
                <AppIcon icon={Users} size="xs" className="shrink-0 text-gray-400" />
              )}
              <p className="text-sm font-medium text-foreground">{attendanceLabel}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-gray-100/90 pt-5">
          <Link
            to={eventPath}
            className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition duration-150 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
          >
            View Event
          </Link>
          <EventRsvpButton
            currentStatus={nextEvent.current_member_rsvp_status}
            canRsvp
            loading={rsvpLoading}
            embedded
            variant="menu"
            onStatusChange={onRsvpStatusChange}
          />
        </div>
      </div>
    </section>
  );
}
