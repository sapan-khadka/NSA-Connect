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

/**
 * Horizontal strip of calendar-hub KPI tiles.
 * Counts are supplied by the parent — this component does not fetch.
 */
export function EventsStatsStrip({
  upcomingEventsCount,
  tasksDueTodayCount,
  financeApprovalCount,
  meetingsTodayCount,
  today = new Date(),
  className = "",
}: EventsStatsStripProps) {
  return (
    <section
      aria-label="Events overview stats"
      className={["flex flex-wrap gap-2", className].filter(Boolean).join(" ")}
    >
      <StatTile
        icon={Calendar}
        value={formatFocusDate(today)}
        label="Today's Focus"
        tone="teal"
      />
      <StatTile
        icon={CalendarDays}
        value={upcomingEventsCount}
        label="Upcoming events"
        tone="purple"
      />
      <StatTile
        icon={ClipboardList}
        value={tasksDueTodayCount}
        label="Tasks due today"
        tone="coral"
      />
      <StatTile
        icon={DollarSign}
        value={financeApprovalCount}
        label="Finance approval"
        tone="green"
      />
      <StatTile
        icon={Users}
        value={meetingsTodayCount}
        label="Meetings today"
        tone="blue"
      />
    </section>
  );
}
