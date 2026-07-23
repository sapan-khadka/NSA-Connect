import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import nsaCover from "../../assets/nsa-cover.PNG";
import { eventDetailPath } from "../../lib/event-links";
import {
  fetchEventAttendees,
  type EventResponse,
} from "../../lib/events-api";
import {
  fetchEventBudgetForEvent,
  type FinanceEventBudgetSummary,
} from "../../lib/finance-api";
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

function formatMoney(value: string | number): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
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

function RsvpHealthRing({ percent }: { percent: number | null }) {
  const size = 44;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = percent ?? 0;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="home-featured-rsvp-ring" aria-hidden={percent == null}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={percent == null ? circumference : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="home-featured-rsvp-ring-value">
        {percent == null ? "—" : `${percent}%`}
      </span>
    </div>
  );
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
  const [notGoingCount, setNotGoingCount] = useState<number | null>(null);
  const [budgetSummary, setBudgetSummary] =
    useState<FinanceEventBudgetSummary | null>(null);

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
      setNotGoingCount(null);
      setBudgetSummary(null);
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

    void fetchEventBudgetForEvent(event.id)
      .then((summary) => {
        if (!cancelled) {
          setBudgetSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBudgetSummary(null);
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
        className="home-featured home-featured--hero home-featured--cinematic home-featured--loading"
      >
        <div className="home-featured-hero-skeleton" />
      </section>
    );
  }

  if (!event) {
    return (
      <section
        aria-label="Featured Event"
        className="home-featured home-featured--hero home-featured--cinematic home-featured--empty"
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
  const dateBlock = getDateBlockParts(event.starts_at);
  const rsvpHealth = computeRsvpHealth({
    going: goingCount,
    maybe: maybeCount,
    notGoing: notGoingCount,
    capacity: event.capacity,
  });

  const plannedBudget = Number(
    budgetSummary?.planned_budget ?? event.budget ?? 0,
  );
  const spentBudget = Number(budgetSummary?.actual_expense ?? NaN);
  const hasBudget = Number.isFinite(plannedBudget) && plannedBudget > 0;
  const hasSpent = Number.isFinite(spentBudget);
  const budgetProgress =
    hasBudget && hasSpent
      ? Math.min(100, Math.round((spentBudget / plannedBudget) * 100))
      : hasBudget
        ? 0
        : null;

  return (
    <section
      aria-label="Featured Event"
      className="home-featured home-featured--hero home-featured--cinematic"
    >
      <img src={photoUrl} alt="" className="home-featured-photo" />
      <div className="home-featured-hero-scrim" aria-hidden="true" />

      <div className="home-featured-hero-content">
        <div className="home-featured-cinematic-top">
          <div className="home-featured-date-block" aria-hidden="true">
            <span className="home-featured-date-month">{dateBlock.month}</span>
            <span className="home-featured-date-day">{dateBlock.day}</span>
            <span className="home-featured-date-weekday">{dateBlock.weekday}</span>
          </div>

          <div className="home-featured-cinematic-main">
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
          </div>
        </div>

        <div className="home-featured-stats-bar">
          <div className="home-featured-stat-cell">
            <p className="home-featured-rsvp-value">{goingCount ?? "—"}</p>
            <p className="home-featured-rsvp-label">Going</p>
          </div>
          <div className="home-featured-stat-cell">
            <p className="home-featured-rsvp-value">{maybeCount ?? "—"}</p>
            <p className="home-featured-rsvp-label">Maybe</p>
          </div>
          <div className="home-featured-stat-cell home-featured-stat-cell--health">
            <RsvpHealthRing percent={rsvpHealth} />
            <p className="home-featured-rsvp-label">RSVP Health</p>
          </div>
          <div className="home-featured-stat-cell home-featured-stat-cell--budget">
            <div className="home-featured-budget-head">
              <span>Budget</span>
              <span>
                {hasSpent ? formatMoney(spentBudget) : "—"}
                {" / "}
                {hasBudget ? formatMoney(plannedBudget) : formatMoney(event.budget || 0)}
              </span>
            </div>
            <div className="home-featured-prep-track" aria-hidden="true">
              <span
                className="home-featured-prep-fill"
                style={{ width: `${budgetProgress ?? 0}%` }}
              />
            </div>
          </div>
          <div className="home-featured-actions">
            <Link
              to={eventPath}
              className="home-featured-btn home-featured-btn--primary"
            >
              Open Event
              <AppIcon icon={ExternalLink} size="xs" className="text-current" />
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
