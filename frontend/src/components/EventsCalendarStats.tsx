/**
 * Compact calendar KPI row — reuses Home stat-card visual language.
 * Counts use real calendar/upcoming event data only.
 */

import {
  CalendarCheck2,
  CalendarDays,
  Clock3,
  Users,
} from "lucide-react";

import { IconBadge } from "./ui/IconBadge";

export type EventsCalendarStatsData = {
  thisMonth: number;
  upcoming: number;
  today: number;
  /** Sum of going RSVPs across upcoming events (see EventsPage comment). */
  totalAttendees: number | null;
  loading?: boolean;
};

type EventsCalendarStatsProps = {
  stats: EventsCalendarStatsData;
};

export function EventsCalendarStats({ stats }: EventsCalendarStatsProps) {
  const cards = [
    {
      key: "month",
      label: "This month",
      value: stats.loading ? "—" : String(stats.thisMonth),
      hint: "Past + upcoming",
      icon: CalendarDays,
    },
    {
      key: "upcoming",
      label: "Upcoming",
      value: stats.loading ? "—" : String(stats.upcoming),
      hint: "All months",
      icon: CalendarCheck2,
    },
    {
      key: "today",
      label: "Today",
      value: stats.loading ? "—" : String(stats.today),
      hint: "Events",
      icon: Clock3,
    },
    {
      key: "attendees",
      label: "Total attendees",
      value:
        stats.loading || stats.totalAttendees == null
          ? "—"
          : String(stats.totalAttendees),
      hint: "across upcoming",
      icon: Users,
    },
  ];

  return (
    <ul className="events-calendar-stats" aria-label="Calendar summary">
      {cards.map((card) => (
        <li key={card.key}>
          <div className="events-calendar-stat-card">
            <div className="flex items-center gap-2">
              <IconBadge
                icon={card.icon}
                tone="gray"
                size="xs"
                shape="rounded"
              />
              <p className="truncate text-xs font-normal leading-relaxed tracking-[0.04em] text-gray-500">
                {card.label}
              </p>
            </div>
            <p className="home-stat-value mt-2">{card.value}</p>
            <p className="mt-1 line-clamp-1 text-xs font-normal leading-relaxed tracking-[0.01em] text-gray-500">
              {card.hint}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
