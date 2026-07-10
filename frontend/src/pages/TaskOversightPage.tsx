import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SectionLabel } from "../components/ui/SectionLabel";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchTaskOverview,
  type EventTaskResponse,
  type EventTaskStatus,
  type TaskOverviewMember,
  type TaskOverviewResponse,
} from "../lib/event-tasks-api";
import {
  canViewTaskOversight,
  formatPositionLabel,
  formatRoleLabel,
  type MemberRole,
} from "../lib/roles";
import {
  ACTIVE_ASSIGNMENTS_SORT_OPTIONS,
  ASSIGNEE_CATEGORY_FILTER_OPTIONS,
  countOverdueTasks,
  filterOverviewMembersByAssigneeCategory,
  sortActiveMembers,
  sortUnassignedMembers,
  splitTaskOverviewMembers,
  shouldShowUnassignedBoardMembers,
  type ActiveAssignmentsSort,
  type AssigneeCategoryFilter,
} from "../lib/task-oversight";

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

function ActiveMemberCard({ row }: { row: TaskOverviewMember }) {
  return (
    <section className="ds-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-light tracking-subhead text-foreground">
            {row.full_name}
          </h3>
          <p className="mt-1 text-sm text-label">
            {formatRoleLabel(row.role as MemberRole)} ·{" "}
            {formatPositionLabel(row.position)}
          </p>
        </div>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
          {row.completed}/{row.total} done ({row.completion_percent}%)
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {row.tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </ul>
    </section>
  );
}

function TaskRow({ task }: { task: EventTaskResponse }) {
  return (
    <li className="rounded-md ds-card-nested p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{task.title}</p>
          <p className="mt-1 text-xs text-label">{task.event_name}</p>
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
  );
}

export function TaskOversightPage() {
  const { member } = useAuth();
  const [overview, setOverview] = useState<TaskOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSort, setActiveSort] =
    useState<ActiveAssignmentsSort>("incomplete_first");
  const [assigneeFilter, setAssigneeFilter] =
    useState<AssigneeCategoryFilter>("all");

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

  const { activeMembers, unassignedMembers, overdueCount, completePercent } =
    useMemo(() => {
      if (!overview) {
        return {
          activeMembers: [] as TaskOverviewMember[],
          unassignedMembers: [] as TaskOverviewMember[],
          overdueCount: 0,
          completePercent: 0,
        };
      }

      const filteredMembers = filterOverviewMembersByAssigneeCategory(
        overview.members,
        assigneeFilter,
      );
      const { active, unassigned } = splitTaskOverviewMembers(filteredMembers);

      return {
        activeMembers: sortActiveMembers(active, activeSort),
        unassignedMembers: shouldShowUnassignedBoardMembers(assigneeFilter)
          ? sortUnassignedMembers(unassigned)
          : [],
        overdueCount: countOverdueTasks(overview.members),
        completePercent:
          overview.total_tasks > 0
            ? Math.round(
                (overview.completed_tasks / overview.total_tasks) * 100,
              )
            : 0,
      };
    }, [overview, activeSort, assigneeFilter]);

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

  return (
    <div className="space-y-8">
      {overview ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="ds-stat-tile">
            <p className="text-sm text-label">Total tasks</p>
            <p className="ds-stat-value">{overview.total_tasks}</p>
          </div>

          <div className="ds-stat-tile">
            <SectionLabel
              icon={AlertCircle}
              iconClassName="text-overdue"
              className="text-overdue"
            >
              Overdue
            </SectionLabel>
            <p className="ds-stat-overdue-chip">{overdueCount}</p>
          </div>

          <div className="ds-stat-tile">
            <p className="text-sm text-label">Complete</p>
            <p className="ds-stat-value">{completePercent}%</p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="ds-card p-10 text-center text-label">
          Loading oversight…
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner p-6">
          {error}
        </div>
      ) : null}

      {overview && !isLoading && !error ? (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-light tracking-subhead text-foreground">
                  Active assignments
                </h2>
                <p className="mt-1 text-sm text-label">
                  {activeMembers.length} member
                  {activeMembers.length === 1 ? "" : "s"} with assigned tasks
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-label">
                  Assignee
                  <select
                    aria-label="Assignee"
                    value={assigneeFilter}
                    onChange={(event) =>
                      setAssigneeFilter(
                        event.target.value as AssigneeCategoryFilter,
                      )
                    }
                    className="ml-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {ASSIGNEE_CATEGORY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-label">
                  Sort by
                  <select
                    aria-label="Sort by"
                    value={activeSort}
                    onChange={(event) =>
                      setActiveSort(event.target.value as ActiveAssignmentsSort)
                    }
                    className="ml-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {ACTIVE_ASSIGNMENTS_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {activeMembers.length === 0 ? (
              <p className="text-sm text-label">
                {assigneeFilter === "all"
                  ? "No members currently have assigned tasks."
                  : "No members match this assignee filter."}
              </p>
            ) : (
              <div className="space-y-6">
                {activeMembers.map((row) => (
                  <ActiveMemberCard key={row.member_id} row={row} />
                ))}
              </div>
            )}
          </section>

          {unassignedMembers.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-light tracking-subhead text-foreground">
                  No tasks assigned
                </h2>
                <p className="mt-1 text-sm text-label">
                  {unassignedMembers.length} board member
                  {unassignedMembers.length === 1 ? "" : "s"} without current
                  assignments
                </p>
              </div>

              <ul className="max-h-72 divide-y divide-gray-200 overflow-y-auto rounded-card border border-gray-200 bg-surface-card">
                {unassignedMembers.map((row) => (
                  <li
                    key={row.member_id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {row.full_name}
                    </span>
                    <span className="text-label">
                      {formatRoleLabel(row.role as MemberRole)} ·{" "}
                      {formatPositionLabel(row.position)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
