import { AlertTriangle, Check, UserRound } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";

import type {
  EventTaskResponse,
  TaskOverviewMember,
} from "../../lib/event-tasks-api";
import { getTaskDisplayName } from "../../lib/home-tasks";
import type { WidgetDensity } from "../../lib/home-workspace";
import { AppIcon } from "../ui/AppIcon";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

type HomeTeamPulseProps = {
  members: TaskOverviewMember[];
  isLoading?: boolean;
  density?: WidgetDensity;
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

export function HomeTeamPulse({
  members,
  isLoading = false,
  density = "md",
}: HomeTeamPulseProps) {
  const now = useMemo(() => new Date(), []);

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

  const membersNeedingHelp = useMemo(() => {
    return members.filter((member) =>
      member.tasks.some(
        (task) =>
          !task.is_complete &&
          task.status !== "done" &&
          (task.is_overdue || task.status === "blocked"),
      ),
    ).length;
  }, [members]);

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

  const topPriority = useMemo(() => {
    const overdue = openTasks
      .filter((task) => task.is_overdue)
      .sort((a, b) =>
        (a.due_date ?? "").localeCompare(b.due_date ?? ""),
      );
    const pick = overdue[0] ?? openTasks[0] ?? null;
    if (!pick) {
      return null;
    }
    return {
      title: getTaskDisplayName(pick),
      assignee: pick.assignee_name?.trim() || "Unassigned",
      eventName: pick.event_name,
    };
  }, [openTasks]);

  const compact = density === "xs" || density === "sm";

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-team-pulse home-task-surface"
      aria-label="Team pulse"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Team Pulse</h2>
        <ArrowLink to="/events/oversight" className="home-hide-xs">
          Go to tasks
        </ArrowLink>
      </div>

      {isLoading ? (
        <p className="home-activity-empty">Loading…</p>
      ) : (
        <>
          <ul className="home-team-pulse-narrative" aria-label="Team summary">
            <li
              className={
                overdueCount > 0
                  ? "home-team-pulse-narrative__item is-alert"
                  : "home-team-pulse-narrative__item"
              }
            >
              <AppIcon
                icon={AlertTriangle}
                size="sm"
                className="text-current"
              />
              <span>
                {overdueCount === 0
                  ? "No overdue tasks"
                  : `${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}`}
              </span>
            </li>
            <li
              className={
                membersNeedingHelp > 0
                  ? "home-team-pulse-narrative__item is-alert"
                  : "home-team-pulse-narrative__item"
              }
            >
              <AppIcon icon={UserRound} size="sm" className="text-current" />
              <span>
                {membersNeedingHelp === 0
                  ? "Nobody needs help"
                  : `${membersNeedingHelp} member${
                      membersNeedingHelp === 1 ? "" : "s"
                    } need${membersNeedingHelp === 1 ? "s" : ""} help`}
              </span>
            </li>
            {!compact ? (
              <li className="home-team-pulse-narrative__item is-ok">
                <AppIcon icon={Check} size="sm" className="text-current" />
                <span>
                  {completedToday === 0
                    ? "No completions today"
                    : `${completedToday} completed today`}
                </span>
              </li>
            ) : null}
          </ul>

          {!compact && topPriority ? (
            <div className="home-team-pulse-priority">
              <p className="home-team-pulse-deadlines-label">Top priority</p>
              <Link to="/events/oversight" className="home-team-pulse-priority__card">
                <span className="home-team-pulse-priority__person">
                  {topPriority.assignee}
                </span>
                <span className="home-team-pulse-priority__title">
                  {topPriority.title}
                </span>
                {topPriority.eventName ? (
                  <span className="home-team-pulse-priority__meta">
                    {topPriority.eventName}
                  </span>
                ) : null}
              </Link>
            </div>
          ) : null}

          {!compact && !topPriority ? (
            <p className="home-team-pulse-clear">Everyone is on track</p>
          ) : null}
        </>
      )}
    </HomeCard>
  );
}
