import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchTaskOverview,
  type EventTaskResponse,
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

function YourTaskRow({ task }: { task: EventTaskResponse }) {
  const badge = task.is_overdue
    ? { label: "Action", tone: "action" as const }
    : task.status === "in_progress"
      ? { label: "Review", tone: "review" as const }
      : { label: "Action", tone: "action" as const };

  return (
    <li>
      <Link
        to="/events/oversight"
        className="home-your-task-row"
      >
        <span className="home-your-task-title">{getTaskDisplayName(task)}</span>
        <span className={`home-your-task-badge is-${badge.tone}`}>
          {badge.label}
        </span>
        <span
          className={[
            "home-task-due-text",
            task.is_overdue ? "is-overdue" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {formatTaskDate(task.due_date)}
        </span>
      </Link>
    </li>
  );
}

export function HomeYourTasksSection() {
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchTaskOverview()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const byId = new Map<number, EventTaskResponse>();
        for (const member of response.members) {
          for (const task of member.tasks) {
            if (!task.is_complete && task.status !== "done") {
              byId.set(task.id, task);
            }
          }
        }
        setTasks([...byId.values()]);
      })
      .catch(() => {
        if (!cancelled) {
          setTasks([]);
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

  const preview = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) {
          return a.is_overdue ? -1 : 1;
        }
        return (a.due_date ?? "").localeCompare(b.due_date ?? "");
      })
      .slice(0, 3);
  }, [tasks]);

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-your-tasks-card"
      aria-label="Task Oversight"
    >
      <div className="home-task-header">
        <h2 className="home-panel-title">Task Oversight</h2>
        <ArrowLink to="/events/oversight">View all</ArrowLink>
      </div>

      <div className="home-task-body">
        {isLoading ? (
          <p className="home-activity-empty">Loading tasks…</p>
        ) : preview.length === 0 ? (
          <div className="home-task-empty">
            <p className="home-task-empty-title">All clear</p>
            <p className="home-task-empty-copy">No open chapter tasks.</p>
          </div>
        ) : (
          <ul className="home-your-task-list">
            {preview.map((task) => (
              <YourTaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </div>

      <div className="home-task-footer">
        <Link to="/events/oversight" className="home-panel-footer-link">
          + Add new task
        </Link>
      </div>
    </HomeCard>
  );
}
