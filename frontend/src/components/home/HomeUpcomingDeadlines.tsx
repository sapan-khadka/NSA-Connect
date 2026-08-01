import { useMemo } from "react";
import { Link } from "react-router-dom";

import type {
  EventTaskResponse,
  TaskOverviewMember,
} from "../../lib/event-tasks-api";
import { getTaskDisplayName } from "../../lib/home-tasks";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";

type DeadlineRow = {
  task: EventTaskResponse;
  assignee: string;
};

type HomeUpcomingDeadlinesProps = {
  personalTasks?: EventTaskResponse[];
  overviewMembers?: TaskOverviewMember[];
  useOversight?: boolean;
  isLoading?: boolean;
  tasksPath: string;
  limit?: number;
};

function dateParts(isoDate: string | null | undefined): {
  month: string;
  day: string;
} {
  if (!isoDate) {
    return { month: "—", day: "—" };
  }
  const date = new Date(isoDate);
  return {
    month: new Intl.DateTimeFormat(undefined, { month: "short" })
      .format(date)
      .toUpperCase(),
    day: new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date),
  };
}

function sortDeadlines(rows: DeadlineRow[]): DeadlineRow[] {
  return [...rows].sort((a, b) => {
    if (a.task.is_overdue !== b.task.is_overdue) {
      return a.task.is_overdue ? -1 : 1;
    }
    return (a.task.due_date ?? "9999").localeCompare(b.task.due_date ?? "9999");
  });
}

export function HomeUpcomingDeadlines({
  personalTasks = [],
  overviewMembers = [],
  useOversight = false,
  isLoading = false,
  tasksPath,
  limit = 5,
}: HomeUpcomingDeadlinesProps) {
  const rows = useMemo(() => {
    if (useOversight) {
      const byId = new Map<number, DeadlineRow>();
      for (const member of overviewMembers) {
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
      return sortDeadlines([...byId.values()]).slice(0, limit);
    }
    const personal = personalTasks
      .filter((task) => !task.is_complete && task.status !== "done")
      .map((task) => ({
        task,
        assignee: task.assignee_name || "You",
      }));
    return sortDeadlines(personal).slice(0, limit);
  }, [useOversight, overviewMembers, personalTasks, limit]);

  const linkTo = useOversight ? "/events/oversight" : tasksPath;

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-upcoming-deadlines home-task-surface"
      aria-label="Upcoming deadlines"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Upcoming Deadlines</h2>
        <ArrowLink to={linkTo}>View all</ArrowLink>
      </div>

      {isLoading ? (
        <p className="home-activity-empty">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="home-activity-empty">No open deadlines</p>
      ) : (
        <ul className="home-deadline-list">
          {rows.map(({ task, assignee }) => {
            const date = dateParts(task.due_date);
            return (
              <li key={task.id}>
                <Link
                  to={linkTo}
                  className={[
                    "home-deadline-row",
                    task.is_overdue ? "is-overdue" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <time
                    className="home-deadline-date"
                    dateTime={task.due_date ?? undefined}
                  >
                    <span className="home-deadline-date__month">{date.month}</span>
                    <span className="home-deadline-date__day">{date.day}</span>
                  </time>
                  <span className="home-deadline-copy">
                    <span className="home-deadline-title">
                      {getTaskDisplayName(task)}
                    </span>
                    <span className="home-deadline-meta">
                      {task.event_name?.trim() || assignee}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
