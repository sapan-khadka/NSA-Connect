import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchTaskOverview,
  type EventTaskResponse,
  type TaskOverviewMember,
} from "../../lib/event-tasks-api";
import { getTaskDisplayName } from "../../lib/home-tasks";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

function formatTaskDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "No date";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

type DeadlineRow = {
  task: EventTaskResponse;
  assignee: string;
};

export function HomeTeamPulse() {
  const [members, setMembers] = useState<TaskOverviewMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchTaskOverview()
      .then((response) => {
        if (!cancelled) {
          setMembers(response.members);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openTasks = useMemo(() => {
    const byId = new Map<number, DeadlineRow>();
    for (const member of members) {
      for (const task of member.tasks) {
        if (task.is_complete || task.status === "done") {
          continue;
        }
        byId.set(task.id, {
          task,
          assignee: member.full_name,
        });
      }
    }
    return [...byId.values()];
  }, [members]);

  const overdueCount = openTasks.filter((row) => row.task.is_overdue).length;
  const membersNeedingAttention = useMemo(() => {
    return members.filter((member) =>
      member.tasks.some(
        (task) =>
          !task.is_complete &&
          task.status !== "done" &&
          (task.is_overdue || task.status === "blocked"),
      ),
    ).length;
  }, [members]);

  const dueThisWeekCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + (7 - end.getDay()));
    end.setHours(23, 59, 59, 999);
    return openTasks.filter((row) => {
      if (!row.task.due_date) {
        return false;
      }
      const due = new Date(row.task.due_date);
      return due >= start && due <= end;
    }).length;
  }, [openTasks]);

  const upcomingDeadlines = useMemo(() => {
    return [...openTasks]
      .sort((a, b) => {
        if (a.task.is_overdue !== b.task.is_overdue) {
          return a.task.is_overdue ? -1 : 1;
        }
        return (a.task.due_date ?? "9999").localeCompare(
          b.task.due_date ?? "9999",
        );
      })
      .slice(0, 3);
  }, [openTasks]);

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-team-pulse home-task-surface"
      aria-label="Team pulse"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Team pulse</h2>
        <ArrowLink to="/events/oversight">Oversight</ArrowLink>
      </div>

      {isLoading ? (
        <p className="home-activity-empty">Loading…</p>
      ) : (
        <>
          <div className="home-team-pulse-stats" aria-label="Team summary">
            <div className="home-team-pulse-stat">
              <span className="home-team-pulse-stat-value">{openTasks.length}</span>
              <span className="home-team-pulse-stat-label">Open</span>
            </div>
            <div className="home-team-pulse-stat">
              <span
                className={[
                  "home-team-pulse-stat-value",
                  overdueCount > 0 ? "is-alert" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {overdueCount}
              </span>
              <span className="home-team-pulse-stat-label">Overdue</span>
            </div>
            <div className="home-team-pulse-stat">
              <span className="home-team-pulse-stat-value">{dueThisWeekCount}</span>
              <span className="home-team-pulse-stat-label">This week</span>
            </div>
            <div className="home-team-pulse-stat">
              <span
                className={[
                  "home-team-pulse-stat-value",
                  membersNeedingAttention > 0 ? "is-alert" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {membersNeedingAttention}
              </span>
              <span className="home-team-pulse-stat-label">Need help</span>
            </div>
          </div>

          <div className="home-team-pulse-deadlines">
            <p className="home-team-pulse-deadlines-label">Upcoming deadlines</p>
            {upcomingDeadlines.length === 0 ? (
              <p className="home-activity-empty">No open deadlines</p>
            ) : (
              <ul className="home-team-pulse-list">
                {upcomingDeadlines.map(({ task, assignee }) => (
                  <li key={task.id}>
                    <Link to="/events/oversight" className="home-team-pulse-row">
                      <span className="home-team-pulse-row-main">
                        <span className="home-team-pulse-row-title">
                          {getTaskDisplayName(task)}
                        </span>
                        <span className="home-team-pulse-row-assignee">
                          {assignee}
                        </span>
                      </span>
                      <time
                        className={[
                          "home-team-pulse-row-due",
                          task.is_overdue ? "is-overdue" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        dateTime={task.due_date ?? undefined}
                      >
                        {formatTaskDate(task.due_date)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </HomeCard>
  );
}
