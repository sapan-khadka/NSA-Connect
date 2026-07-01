import { useEffect, useState } from "react";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchTaskOverview,
  type EventTaskStatus,
  type TaskOverviewResponse,
} from "../lib/event-tasks-api";
import {
  canViewTaskOversight,
  formatPositionLabel,
  formatRoleLabel,
  type MemberRole,
} from "../lib/roles";

const STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_BADGE_STYLES: Record<EventTaskStatus, string> = {
  todo: "bg-surface-muted text-foreground",
  in_progress: "bg-surface-card text-label",
  done: "bg-mint text-primary",
};

export function TaskOversightPage() {
  const { member } = useAuth();
  const [overview, setOverview] = useState<TaskOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowed = member
    ? canViewTaskOversight(member.role, member.position)
    : false;

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchTaskOverview();
        if (!cancelled) {
          setOverview(response);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!member) {
    return null;
  }

  if (!allowed) {
    return (
      <div className="ds-card p-6 text-foreground">
        Only the President or Vice President can view the task oversight
        dashboard.
      </div>
    );
  }

  const overallPercent =
    overview && overview.total_tasks > 0
      ? Math.round((overview.completed_tasks / overview.total_tasks) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {overview ? (
        <p className="text-sm font-medium text-foreground">
          {overview.completed_tasks} of {overview.total_tasks} tasks complete (
          {overallPercent}%)
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-card bg-surface-card p-10 text-center text-label">
          Loading oversight…
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="ds-alert-banner p-6"
        >
          {error}
        </div>
      ) : null}

      {overview && !isLoading && !error ? (
        <div className="space-y-6">
          {overview.members.map((row) => (
            <section
              key={row.member_id}
              className="rounded-card bg-surface-card p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-light tracking-subhead text-foreground">
                    {row.full_name}
                  </h2>
                  <p className="mt-1 text-sm text-label">
                    {formatRoleLabel(row.role as MemberRole)} ·{" "}
                    {formatPositionLabel(row.position)}
                  </p>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                  {row.completed}/{row.total} done ({row.completion_percent}%)
                </span>
              </div>

              {row.tasks.length === 0 ? (
                <p className="mt-4 text-sm text-label">No tasks assigned.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {row.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-md border border-gray-200 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {task.title}
                          </p>
                          <p className="mt-1 text-xs text-label">
                            {task.event_name}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[task.status]}`}
                        >
                          {STATUS_LABELS[task.status]}
                        </span>
                      </div>

                      {task.completion_note ? (
                        <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-foreground">
                          Note: {task.completion_note}
                        </p>
                      ) : null}

                      {task.completion_photo_url ? (
                        <a
                          href={task.completion_photo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block"
                        >
                          <img
                            src={task.completion_photo_url}
                            alt={`Completion photo for ${task.title}`}
                            className="h-20 w-20 rounded object-cover"
                          />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
