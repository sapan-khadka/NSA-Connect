import {
  Calendar,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Users,
  type LucideIcon,
} from "lucide-react";

import { AppIcon } from "./ui/AppIcon";

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

function StatCell({
  icon,
  value,
  valueShort,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string | number;
  valueShort?: string | number;
  label: string;
  tone: StatTone;
}) {
  return (
    <article
      className={`events-kpi-cell events-kpi-cell--${tone}`}
      aria-label={`${label}: ${value}`}
    >
      <span className="events-kpi-cell__icon" aria-hidden="true">
        <AppIcon icon={icon} size="sm" className="text-current" />
      </span>
      <p className="events-kpi-cell__value">
        {valueShort != null ? (
          <>
            <span className="events-kpi-cell__value--long">{value}</span>
            <span className="events-kpi-cell__value--short">{valueShort}</span>
          </>
        ) : (
          value
        )}
      </p>
      <p className="events-kpi-cell__label">{label}</p>
    </article>
  );
}

/**
 * Events dashboard KPI row — icon · value · label with vertical dividers.
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
      value: focusLong,
      valueShort: focusShort,
      label: "Today's Focus",
      tone: "teal" as const,
    },
    {
      icon: CalendarDays,
      value: upcomingEventsCount,
      label: "Upcoming events",
      tone: "purple" as const,
    },
    {
      icon: ClipboardList,
      value: tasksDueTodayCount,
      label: "Tasks due today",
      tone: "coral" as const,
    },
    {
      icon: DollarSign,
      value: financeApprovalCount,
      label: "Finance approval",
      tone: "green" as const,
    },
    {
      icon: Users,
      value: meetingsTodayCount,
      label: "Meetings today",
      tone: "blue" as const,
    },
  ];

  return (
    <section
      aria-label="Events overview stats"
      className={["events-kpi-strip", className].filter(Boolean).join(" ")}
    >
      <div className="events-kpi-strip__row">
        {items.map((item) => (
          <StatCell
            key={item.label}
            icon={item.icon}
            value={item.value}
            valueShort={item.valueShort}
            label={item.label}
            tone={item.tone}
          />
        ))}
      </div>
    </section>
  );
}
