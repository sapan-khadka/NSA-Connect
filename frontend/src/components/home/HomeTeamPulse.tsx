import { useMemo } from "react";
import { Link } from "react-router";

import type {
  EventTaskResponse,
  TaskOverviewMember,
} from "../../lib/event-tasks-api";
import type { EventResponse } from "../../lib/events-api";
import type { WidgetDensity } from "../../lib/home-workspace";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

type HomeTeamPulseProps = {
  members: TaskOverviewMember[];
  isLoading?: boolean;
  density?: WidgetDensity;
  pendingMemberApprovals?: number;
  financePendingCount?: number;
  nextEvent?: EventResponse | null;
  approvedMemberCount?: number | null;
};

type HealthTone = "ok" | "warn" | "alert";

type HealthRow = {
  id: string;
  tone: HealthTone;
  label: string;
  href: string;
};

function isCompletedToday(task: EventTaskResponse, now: Date): boolean {
  if (!task.is_complete || !task.completed_at) {
    return false;
  }
  const completed = new Date(task.completed_at);
  return (
    completed.getFullYear() === now.getFullYear() &&
    completed.getMonth() === now.getMonth() &&
    completed.getDate() === now.getDate()
  );
}

function formatNextEvent(event: EventResponse): string {
  const when = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(event.starts_at));
  return `${event.name} · ${when}`;
}

/**
 * Executive org summary for the Home workspace (not a task laundry list).
 */
export function HomeTeamPulse({
  members,
  isLoading = false,
  density = "md",
  pendingMemberApprovals = 0,
  financePendingCount = 0,
  nextEvent = null,
  approvedMemberCount = null,
}: HomeTeamPulseProps) {
  const now = useMemo(() => new Date(), []);
  const compact = density === "xs" || density === "sm";

  const openTasks = useMemo(() => {
    const byId = new Map<number, EventTaskResponse>();
    for (const member of members) {
      for (const task of member.tasks) {
        if (task.is_complete || task.status === "done") {
          continue;
        }
        byId.set(task.id, task);
      }
    }
    return [...byId.values()];
  }, [members]);

  const overdueCount = openTasks.filter((task) => task.is_overdue).length;

  const completedToday = useMemo(() => {
    const byId = new Map<number, EventTaskResponse>();
    for (const member of members) {
      for (const task of member.tasks) {
        if (isCompletedToday(task, now)) {
          byId.set(task.id, task);
        }
      }
    }
    return byId.size;
  }, [members, now]);

  const rows = useMemo((): HealthRow[] => {
    const next: HealthRow[] = [];

    if (approvedMemberCount != null && approvedMemberCount > 0) {
      next.push({
        id: "members",
        tone: "ok",
        label: `${approvedMemberCount} active member${approvedMemberCount === 1 ? "" : "s"}`,
        href: "/members",
      });
    }

    if (pendingMemberApprovals > 0) {
      next.push({
        id: "pending",
        tone: "warn",
        label: `${pendingMemberApprovals} pending approval${pendingMemberApprovals === 1 ? "" : "s"}`,
        href: "/members?tab=pending",
      });
    }

    if (overdueCount > 0) {
      next.push({
        id: "overdue",
        tone: "alert",
        label: `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}`,
        href: "/events/oversight",
      });
    } else if (!compact) {
      next.push({
        id: "tasks-ok",
        tone: "ok",
        label:
          completedToday > 0
            ? `${completedToday} completed today`
            : "No overdue tasks",
        href: "/events/tasks",
      });
    }

    if (financePendingCount > 0) {
      next.push({
        id: "treasury",
        tone: "alert",
        label: `${financePendingCount} treasury item${financePendingCount === 1 ? "" : "s"} need review`,
        href: "/finance",
      });
    } else {
      next.push({
        id: "treasury-ok",
        tone: "ok",
        label: "Treasury clear",
        href: "/finance",
      });
    }

    if (nextEvent) {
      next.push({
        id: "next-event",
        tone: "ok",
        label: `Next · ${formatNextEvent(nextEvent)}`,
        href: `/events/${nextEvent.id}`,
      });
    }

    return next.slice(0, compact ? 3 : 4);
  }, [
    approvedMemberCount,
    pendingMemberApprovals,
    overdueCount,
    completedToday,
    financePendingCount,
    nextEvent,
    compact,
  ]);

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-org-health home-task-surface"
      aria-label="Organization Health"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Organization Health</h2>
        <ArrowLink to="/events/oversight" className="home-hide-xs">
          Details
        </ArrowLink>
      </div>

      {isLoading ? (
        <p className="home-activity-empty">Loading…</p>
      ) : (
        <ul className="home-org-health__list" aria-label="Health summary">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={row.href}
                className={`home-org-health__row is-${row.tone}`}
              >
                <span className="home-org-health__dot" aria-hidden />
                <span className="home-org-health__label">{row.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  );
}
