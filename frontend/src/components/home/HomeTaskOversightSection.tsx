import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchTaskOverview,
  type EventTaskResponse,
} from "../../lib/event-tasks-api";
import {
  listOversightEvents,
  type OversightEventOption,
} from "../../lib/task-oversight";
import { ArrowLink } from "../ui/ArrowLink";
import { EmptyState } from "../ui/EmptyState";
import { HomeCard } from "../ui/HomeCard";

function OversightRow({ event }: { event: OversightEventOption }) {
  const completionPercent =
    event.totalTasks > 0
      ? Math.round((event.completedTasks / event.totalTasks) * 100)
      : 0;

  return (
    <li>
      <Link
        to={`/events/oversight?event=${event.eventId}`}
        className="block rounded-lg px-1 py-2 transition hover:bg-surface-muted"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-foreground">
            {event.eventName}
          </span>
          <span
            className={[
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              event.overdueTasks > 0
                ? "bg-rose-50 text-rose-700"
                : event.openTasks > 0
                  ? "bg-amber-50 text-amber-800"
                  : "bg-emerald-50 text-emerald-700",
            ].join(" ")}
          >
            {event.overdueTasks > 0
              ? `${event.overdueTasks} overdue`
              : event.openTasks > 0
                ? `${event.openTasks} open`
                : "Complete"}
          </span>
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${completionPercent}%` }}
            />
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
            {completionPercent}%
          </span>
        </span>
      </Link>
    </li>
  );
}

export type OversightSummary = {
  hasRisk: boolean;
  eventCount: number;
  openTaskCount: number;
};

export function HomeTaskOversightSection({
  embedded = false,
  onSummary,
}: {
  embedded?: boolean;
  onSummary?: (summary: OversightSummary) => void;
} = {}) {
  const [tasks, setTasks] = useState<EventTaskResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchTaskOverview()
      .then((response) => {
        if (!cancelled) {
          const byId = new Map<number, EventTaskResponse>();
          for (const member of response.members) {
            for (const task of member.tasks) {
              byId.set(task.id, task);
            }
          }
          setTasks([...byId.values()]);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTasks([]);
          setLoadError("Couldn’t load task oversight.");
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

  const events = useMemo(() => listOversightEvents(tasks), [tasks]);
  const preview = events.slice(0, 4);
  const overdueEventCount = events.filter(
    (event) => event.overdueTasks > 0,
  ).length;
  const totalOpenTasks = events.reduce(
    (sum, event) => sum + event.openTasks,
    0,
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }
    onSummary?.({
      hasRisk: overdueEventCount > 0,
      eventCount: events.length,
      openTaskCount: totalOpenTasks,
    });
  }, [
    isLoading,
    overdueEventCount,
    events.length,
    totalOpenTasks,
    onSummary,
  ]);

  const body = (
    <>
      {!embedded ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h2 className="home-section-title">Task Oversight</h2>
          <ArrowLink to="/events/oversight">View all</ArrowLink>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-end">
          <ArrowLink to="/events/oversight">View all</ArrowLink>
        </div>
      )}

      {!isLoading && !loadError && events.length > 0 ? (
        <p className="mt-1.5 text-[10px] text-gray-500">
          {overdueEventCount > 0 ? (
            <span className="font-medium text-rose-700">
              {overdueEventCount}{" "}
              {overdueEventCount === 1 ? "event" : "events"} at risk
            </span>
          ) : null}
          {overdueEventCount > 0 ? " · " : null}
          {totalOpenTasks} open {totalOpenTasks === 1 ? "task" : "tasks"}
        </p>
      ) : null}

      <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {isLoading ? (
          <p className="text-xs text-gray-600">Loading oversight…</p>
        ) : null}

        {loadError ? (
          <p className="text-xs text-overdue" role="alert">
            {loadError}
          </p>
        ) : null}

        {!isLoading && !loadError && preview.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {preview.map((event) => (
              <OversightRow key={event.eventId} event={event} />
            ))}
          </ul>
        ) : null}

        {!isLoading && !loadError && preview.length === 0 ? (
          <EmptyState
            icon="check"
            title="No event tasks"
            description="Create event tasks to track progress here."
          />
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div
        className="flex h-full min-h-0 flex-col"
        aria-label="Task Oversight"
      >
        {body}
      </div>
    );
  }

  return (
    <HomeCard
      padding="xs"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="Task Oversight"
    >
      {body}
    </HomeCard>
  );
}
