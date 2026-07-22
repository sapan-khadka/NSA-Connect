import {
  CalendarDays,
  ListTodo,
  MessageSquare,
  UsersRound,
} from "lucide-react";

import { isSameLocalDay } from "./HomeTodayTimeline";
import type { EventResponse } from "../../lib/events-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { AppIcon } from "../ui/AppIcon";
import { HomeCard } from "../ui/HomeCard";

export function HomeTodayGlance({
  events,
  tasksSummary,
  discussionCount,
  isLoading,
}: {
  events: EventResponse[];
  tasksSummary: MyTasksSummary;
  discussionCount: number;
  isLoading?: boolean;
}) {
  const meetingCount = events.filter(
    (event) =>
      event.event_type === "meeting" && isSameLocalDay(event.starts_at),
  ).length;
  const eventCount = events.filter(
    (event) =>
      event.event_type !== "meeting" && isSameLocalDay(event.starts_at),
  ).length;

  const items = [
    {
      id: "meetings",
      label: "Meeting",
      value: isLoading ? "—" : String(meetingCount),
      icon: UsersRound,
      tone: "teal" as const,
    },
    {
      id: "tasks",
      label: "Tasks",
      value: isLoading ? "—" : String(tasksSummary.dueTodayCount),
      icon: ListTodo,
      tone: "amber" as const,
    },
    {
      id: "events",
      label: "Event",
      value: isLoading ? "—" : String(eventCount),
      icon: CalendarDays,
      tone: "slate" as const,
    },
    {
      id: "discussions",
      label: "Discussions",
      value: String(discussionCount),
      icon: MessageSquare,
      tone: "blue" as const,
    },
  ];

  return (
    <HomeCard
      padding="sm"
      className="home-glance home-surface-quiet"
      aria-label="Today at a glance"
    >
      <h2 className="home-panel-title">Today at a glance</h2>
      <ul className="home-glance-grid">
        {items.map((item) => (
          <li key={item.id} className={`home-glance-item home-glance-item--${item.tone}`}>
            <span className="home-glance-icon" aria-hidden="true">
              <AppIcon icon={item.icon} size="sm" className="text-current" />
            </span>
            <p className="home-glance-value">{item.value}</p>
            <p className="home-glance-label">{item.label}</p>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
