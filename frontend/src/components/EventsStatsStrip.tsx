import {
  Calendar,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Users,
  type LucideIcon,
} from "lucide-react";

import { AppIcon } from "./ui/AppIcon";
import { HomeCard } from "./ui/HomeCard";

export type EventsStatsStripProps = {
  upcomingEventsCount: number;
  tasksDueTodayCount: number;
  financeApprovalCount: number;
  meetingsTodayCount: number;
  /** Override for “Today’s Focus” (defaults to now). */
  today?: Date;
  className?: string;
};

type StatTone = "teal" | "purple" | "coral" | "green" | "blue";

const TONE_CLASS: Record<StatTone, { circle: string; icon: string }> = {
  teal: {
    circle: "bg-badge-teal-bg",
    icon: "text-badge-teal",
  },
  purple: {
    circle: "bg-badge-purple-bg",
    icon: "text-badge-purple",
  },
  /** Orange-tinted tone via coral badge tokens. */
  coral: {
    circle: "bg-badge-coral-bg",
    icon: "text-badge-coral",
  },
  green: {
    circle: "bg-badge-green-bg",
    icon: "text-badge-green",
  },
  blue: {
    circle: "bg-badge-blue-bg",
    icon: "text-badge-blue",
  },
};

function formatFocusDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatFocusDateShort(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone: StatTone;
}) {
  const colors = TONE_CLASS[tone];

  return (
    <HomeCard
      padding="sm"
      className="flex min-w-0 flex-1 basis-[calc(50%-0.375rem)] flex-col items-start gap-1.5 sm:basis-[calc(33.333%-0.5rem)] lg:basis-0 !p-2.5"
      aria-label={`${label}: ${value}`}
    >
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${colors.circle}`}
      >
        <AppIcon icon={icon} size="sm" className={colors.icon} />
      </span>
      <p className="break-words text-sm font-bold leading-snug tracking-tight text-foreground tabular-nums sm:text-base">
        {value}
      </p>
      <p className="text-[11px] font-medium text-label">{label}</p>
    </HomeCard>
  );
}

function StatChip({
  icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone: StatTone;
}) {
  const colors = TONE_CLASS[tone];

  return (
    <div
      className="events-stats-chip"
      aria-label={`${label}: ${value}`}
    >
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${colors.circle}`}
      >
        <AppIcon icon={icon} size="xs" className={colors.icon} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold tabular-nums leading-tight text-foreground">
          {value}
        </span>
        <span className="block truncate text-[10px] font-medium leading-tight text-label">
          {label}
        </span>
      </span>
    </div>
  );
}

/**
 * Horizontal strip of calendar-hub KPI tiles.
 * Below sm: one-row scrollable chips. sm+: wrapping HomeCard tiles.
 */
export function EventsStatsStrip({
  upcomingEventsCount,
  tasksDueTodayCount,
  financeApprovalCount,
  meetingsTodayCount,
  today = new Date(),
  className = "",
}: EventsStatsStripProps) {
  const focusLong = formatFocusDate(today);
  const focusShort = formatFocusDateShort(today);

  const items = [
    {
      icon: Calendar,
      valueLong: focusLong,
      valueShort: focusShort,
      label: "Today's Focus",
      tone: "teal" as const,
    },
    {
      icon: CalendarDays,
      valueLong: upcomingEventsCount,
      valueShort: upcomingEventsCount,
      label: "Upcoming events",
      tone: "purple" as const,
    },
    {
      icon: ClipboardList,
      valueLong: tasksDueTodayCount,
      valueShort: tasksDueTodayCount,
      label: "Tasks due today",
      tone: "coral" as const,
    },
    {
      icon: DollarSign,
      valueLong: financeApprovalCount,
      valueShort: financeApprovalCount,
      label: "Finance approval",
      tone: "green" as const,
    },
    {
      icon: Users,
      valueLong: meetingsTodayCount,
      valueShort: meetingsTodayCount,
      label: "Meetings today",
      tone: "blue" as const,
    },
  ];

  return (
    <section
      aria-label="Events overview stats"
      className={["events-calendar-stats-strip", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="events-stats-chip-row sm:hidden">
        {items.map((item) => (
          <StatChip
            key={item.label}
            icon={item.icon}
            value={item.valueShort}
            label={item.label}
            tone={item.tone}
          />
        ))}
      </div>

      <div className="hidden flex-wrap gap-2 sm:flex">
        {items.map((item) => (
          <StatTile
            key={item.label}
            icon={item.icon}
            value={item.valueLong}
            label={item.label}
            tone={item.tone}
          />
        ))}
      </div>
    </section>
  );
}
