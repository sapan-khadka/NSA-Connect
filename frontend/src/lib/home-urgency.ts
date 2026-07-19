import type { EventResponse } from "./events-api";
import type { MyTasksSummary } from "./home-tasks";

function formatNextEventPhrase(event: EventResponse, now = new Date()): string {
  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) {
    return event.name;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startDay.getTime() - today.getTime()) / dayMs);

  if (diffDays === 0) {
    return `${event.name} is today`;
  }
  if (diffDays === 1) {
    return `${event.name} is tomorrow`;
  }
  if (diffDays > 1) {
    return `${event.name} in ${diffDays} days`;
  }
  return event.name;
}

export function buildHomeUrgencyLine({
  overdueCount,
  dueTodayCount,
  pendingReviewCount,
  nextEvent,
}: {
  overdueCount: number;
  dueTodayCount: number;
  pendingReviewCount: number;
  nextEvent: EventResponse | null;
}): string {
  if (overdueCount > 0) {
    return `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} need attention.`;
  }
  if (pendingReviewCount > 0) {
    return `${pendingReviewCount} review${pendingReviewCount === 1 ? "" : "s"} waiting for you.`;
  }
  if (dueTodayCount > 0) {
    return `${dueTodayCount} task${dueTodayCount === 1 ? "" : "s"} due today.`;
  }
  if (nextEvent) {
    return formatNextEventPhrase(nextEvent);
  }
  return "You're clear — nothing urgent right now.";
}
