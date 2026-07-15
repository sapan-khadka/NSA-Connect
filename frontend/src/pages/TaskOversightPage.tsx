/**
 * Task Oversight — people-first team health dashboard.
 * Data: existing task overview (+ member emails for mailto). No inventing metrics.
 */

import { ChevronDown, Mail, PencilLine, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { AppIcon } from "../components/ui/AppIcon";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchTaskOverview,
  type EventTaskResponse,
  type EventTaskStatus,
  type TaskOverviewResponse,
} from "../lib/event-tasks-api";
import { memberMailtoHref } from "../lib/member-mailto";
import { fetchMembers } from "../lib/members-api";
import { getAssignTaskPath } from "../lib/member-workspace-responsibilities";
import {
  canManageEventTasks,
  canViewTaskOversight,
  formatPositionLabel,
  formatRoleLabel,
  type MemberRole,
} from "../lib/roles";
import {
  ACTIVE_ASSIGNMENTS_SORT_OPTIONS,
  ASSIGNEE_CATEGORY_FILTER_OPTIONS,
  buildOversightSnapshots,
  countHealthStatuses,
  filterOverviewMembersByAssigneeCategory,
  formatOversightDueDate,
  OVERSIGHT_HEALTH_LABELS,
  OVERSIGHT_WORKLOAD_LABELS,
  sortOversightSnapshots,
  type ActiveAssignmentsSort,
  type AssigneeCategoryFilter,
  type OversightMemberSnapshot,
} from "../lib/task-oversight";

const STATUS_LABELS: Record<EventTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

type HealthFilter = "overdue" | "at_risk" | "on_track" | null;

function SegmentedProgress({
  done,
  active,
  overdue,
}: {
  done: number;
  active: number;
  overdue: number;
}) {
  const total = done + active + overdue;
  if (total === 0) {
    return (
      <div
        className="task-oversight-progress is-empty"
        aria-label="No tasks"
      />
    );
  }

  return (
    <div
      className="task-oversight-progress"
      role="img"
      aria-label={`Done ${done}, Active ${active}, Overdue ${overdue}`}
    >
      {done > 0 ? (
        <span
          className="task-oversight-progress-seg is-done"
          style={{ flexGrow: done }}
        />
      ) : null}
      {active > 0 ? (
        <span
          className="task-oversight-progress-seg is-active"
          style={{ flexGrow: active }}
        />
      ) : null}
      {overdue > 0 ? (
        <span
          className="task-oversight-progress-seg is-overdue"
          style={{ flexGrow: overdue }}
        />
      ) : null}
    </div>
  );
}

function TaskDetailRow({ task }: { task: EventTaskResponse }) {
  const dueLabel = formatOversightDueDate(task.due_date);

  return (
    <li className="task-oversight-task-row">
      <div className="task-oversight-task-main">
        <p className="task-oversight-task-title">{task.title}</p>
        <p className="task-oversight-task-meta">
          {task.event_name}
          {dueLabel ? ` · Due ${dueLabel}` : ""}
          {task.is_overdue && !task.is_complete ? " · Overdue" : ""}
        </p>
      </div>
      <span
        className={`task-oversight-task-status task-oversight-task-status--${task.status}`}
      >
        {STATUS_LABELS[task.status]}
      </span>
      {task.completion_note ? (
        <p className="task-oversight-task-note">Note: {task.completion_note}</p>
      ) : null}
      {task.completion_photo_url ? (
        <a
          href={task.completion_photo_url}
          target="_blank"
          rel="noreferrer"
          className="task-oversight-task-photo-link"
        >
          <img
            src={task.completion_photo_url}
            alt={`Completion photo for ${task.title}`}
            className="task-oversight-task-photo"
          />
        </a>
      ) : null}
    </li>
  );
}

function MemberOversightCard({
  snapshot,
  email,
  assignTaskPath,
}: {
  snapshot: OversightMemberSnapshot;
  email: string | null;
  assignTaskPath: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { member, status, workload, nextDueTask } = snapshot;
  const mailto = memberMailtoHref(email);
  const nextDueLabel = nextDueTask
    ? `${nextDueTask.title}${
        formatOversightDueDate(nextDueTask.due_date)
          ? ` · ${formatOversightDueDate(nextDueTask.due_date)}`
          : ""
      }`
    : "No upcoming due date";

  return (
    <article
      className={`task-oversight-card task-oversight-card--${status}`}
      aria-label={`${member.full_name}, ${OVERSIGHT_HEALTH_LABELS[status]}`}
    >
      <div className="task-oversight-card-top">
        <button
          type="button"
          className="task-oversight-card-toggle"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} tasks for ${member.full_name}`}
          onClick={() => setExpanded((value) => !value)}
        >
          <Avatar
            name={member.full_name}
            size="md"
            className="task-oversight-avatar"
          />
          <div className="task-oversight-card-identity">
            <div className="task-oversight-card-title-row">
              <h3 className="task-oversight-card-name">{member.full_name}</h3>
              <span
                className={`task-oversight-status-badge task-oversight-status-badge--${status}`}
              >
                {OVERSIGHT_HEALTH_LABELS[status]}
              </span>
              <span
                className={`task-oversight-workload-badge task-oversight-workload-badge--${workload}`}
              >
                {OVERSIGHT_WORKLOAD_LABELS[workload]}
              </span>
            </div>
            <p className="task-oversight-card-role">
              {formatRoleLabel(member.role as MemberRole)} ·{" "}
              {formatPositionLabel(member.position)}
            </p>
          </div>
          <AppIcon
            icon={ChevronDown}
            size="sm"
            className={`task-oversight-chevron${expanded ? " is-open" : ""}`}
          />
        </button>

        <div className="task-oversight-card-actions" aria-label="Quick actions">
          <Link
            to={`/members/${member.member_id}`}
            className="task-oversight-action"
            title="Open Workspace"
            aria-label={`Open Workspace for ${member.full_name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <AppIcon icon={UserRound} size="xs" className="text-current" />
            <span>Open Workspace</span>
          </Link>
          {assignTaskPath ? (
            <Link
              to={assignTaskPath}
              className="task-oversight-action"
              title="Assign Task"
              aria-label={`Assign Task for ${member.full_name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <AppIcon icon={PencilLine} size="xs" className="text-current" />
              <span>Assign Task</span>
            </Link>
          ) : null}
          {mailto ? (
            <a
              href={mailto}
              className="task-oversight-action"
              title="Message"
              aria-label={`Message ${member.full_name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <AppIcon icon={Mail} size="xs" className="text-current" />
              <span>Message</span>
            </a>
          ) : (
            <span
              className="task-oversight-action is-disabled"
              title="No email on file"
              aria-label={`Message ${member.full_name} (No email on file)`}
            >
              <AppIcon icon={Mail} size="xs" className="text-current" />
              <span>Message</span>
            </span>
          )}
        </div>
      </div>

      <div className="task-oversight-card-summary">
        <SegmentedProgress
          done={snapshot.doneTaskCount}
          active={snapshot.activeNonOverdueCount}
          overdue={snapshot.overdueTaskCount}
        />
        <div className="task-oversight-card-meta-row">
          <p className="task-oversight-next-due">
            <span className="task-oversight-meta-label">Next due</span>
            {nextDueLabel}
          </p>
          <p className="task-oversight-completion tabular-nums">
            {snapshot.completionPercent}% complete · {snapshot.member.total}{" "}
            task{snapshot.member.total === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {expanded ? (
        <ul className="task-oversight-task-list" aria-label="Tasks">
          {member.tasks.length === 0 ? (
            <li className="task-oversight-task-empty">No tasks assigned.</li>
          ) : (
            member.tasks.map((task) => (
              <TaskDetailRow key={task.id} task={task} />
            ))
          )}
        </ul>
      ) : null}
    </article>
  );
}

export function TaskOversightPage() {
  const { member } = useAuth();
  const [overview, setOverview] = useState<TaskOverviewResponse | null>(null);
  const [emailsByMemberId, setEmailsByMemberId] = useState<
    Map<number, string | null>
  >(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSort, setActiveSort] =
    useState<ActiveAssignmentsSort>("status");
  const [assigneeFilter, setAssigneeFilter] =
    useState<AssigneeCategoryFilter>("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>(null);
  const [search, setSearch] = useState("");

  const allowed = member
    ? canViewTaskOversight(member.role, member.position)
    : false;
  const assignTaskPath = member
    ? getAssignTaskPath({
        canManageEventTasks: canManageEventTasks(
          member.role,
          member.position,
        ),
      })
    : null;

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [response, directory] = await Promise.all([
          fetchTaskOverview(),
          fetchMembers({ page: 1, page_size: 100 }).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setOverview(response);
        const emailMap = new Map<number, string | null>();
        for (const row of directory?.members ?? []) {
          emailMap.set(row.id, row.email);
        }
        setEmailsByMemberId(emailMap);
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

  const {
    needsAttention,
    everyoneElse,
    healthCounts,
    completePercent,
  } = useMemo(() => {
    if (!overview) {
      return {
        needsAttention: [] as OversightMemberSnapshot[],
        everyoneElse: [] as OversightMemberSnapshot[],
        healthCounts: { overdue: 0, at_risk: 0, on_track: 0 },
        completePercent: 0,
      };
    }

    const filteredMembers = filterOverviewMembersByAssigneeCategory(
      overview.members,
      assigneeFilter,
    );
    const snapshots = sortOversightSnapshots(
      buildOversightSnapshots(filteredMembers),
      activeSort,
    );
    const counts = countHealthStatuses(snapshots);
    const query = search.trim().toLowerCase();

    const matchesSearch = (row: OversightMemberSnapshot) =>
      !query || row.member.full_name.toLowerCase().includes(query);

    const matchesHealth = (row: OversightMemberSnapshot) =>
      !healthFilter || row.status === healthFilter;

    const attention = snapshots.filter(
      (row) =>
        (row.status === "overdue" || row.status === "at_risk") &&
        matchesSearch(row) &&
        matchesHealth(row),
    );
    const rest = snapshots.filter(
      (row) =>
        (row.status === "on_track" ||
          row.status === "completed" ||
          row.status === "no_data") &&
        matchesSearch(row) &&
        matchesHealth(row),
    );

    return {
      needsAttention: attention,
      everyoneElse: rest,
      healthCounts: counts,
      completePercent:
        overview.total_tasks > 0
          ? Math.round(
              (overview.completed_tasks / overview.total_tasks) * 100,
            )
          : 0,
    };
  }, [overview, activeSort, assigneeFilter, healthFilter, search]);

  function toggleHealthFilter(next: Exclude<HealthFilter, null>) {
    setHealthFilter((current) => (current === next ? null : next));
  }

  if (!member) {
    return null;
  }

  if (!allowed) {
    return (
      <Card padding="md" className="text-foreground">
        Only the President or Vice President can view the task oversight
        dashboard.
      </Card>
    );
  }

  return (
    <div className="task-oversight">
      <header className="task-oversight-header">
        <div>
          <h1 className="task-oversight-title">Task Oversight</h1>
          <p className="task-oversight-subtitle">
            People-first view of assignment health across the team.
          </p>
        </div>
      </header>

      {isLoading ? (
        <Card as="div" padding="none" className="p-10 text-center text-label">
          Loading oversight…
        </Card>
      ) : null}

      {error ? (
        <div role="alert" className="ds-alert-banner p-6">
          {error}
        </div>
      ) : null}

      {overview && !isLoading && !error ? (
        <>
          <section
            className="task-oversight-health"
            aria-label="Today's Team Health"
          >
            <div className="task-oversight-health-heading">
              <h2 className="task-oversight-section-title">
                Today&apos;s Team Health
              </h2>
              <p className="task-oversight-section-desc">
                Click a status to filter the lists below.
              </p>
            </div>
            <div className="task-oversight-health-grid">
              {(
                [
                  ["on_track", "On Track", healthCounts.on_track],
                  ["at_risk", "At Risk", healthCounts.at_risk],
                  ["overdue", "Overdue", healthCounts.overdue],
                ] as const
              ).map(([key, label, value]) => (
                <button
                  key={key}
                  type="button"
                  className={`task-oversight-health-tile task-oversight-health-tile--${key}${
                    healthFilter === key ? " is-active" : ""
                  }`}
                  aria-pressed={healthFilter === key}
                  aria-label={`Filter ${label}`}
                  onClick={() => toggleHealthFilter(key)}
                >
                  <span className="task-oversight-health-label">{label}</span>
                  <span className="task-oversight-health-value tabular-nums">
                    {value}
                  </span>
                </button>
              ))}
              <div
                className="task-oversight-health-tile task-oversight-health-tile--complete"
                aria-label={`Overall completion ${completePercent} percent`}
              >
                <span className="task-oversight-health-label">
                  Overall completion
                </span>
                <span className="task-oversight-health-value tabular-nums">
                  {completePercent}%
                </span>
              </div>
            </div>
          </section>

          <section
            className="task-oversight-section"
            aria-labelledby="needs-attention-heading"
          >
            <div className="task-oversight-section-header">
              <div>
                <h2
                  id="needs-attention-heading"
                  className="task-oversight-section-title"
                >
                  Needs Attention
                </h2>
                <p className="task-oversight-section-desc">
                  {needsAttention.length} member
                  {needsAttention.length === 1 ? "" : "s"} overdue or at risk
                </p>
              </div>
            </div>
            {needsAttention.length === 0 ? (
              <p className="task-oversight-empty">
                No members currently need attention.
              </p>
            ) : (
              <div className="task-oversight-card-list">
                {needsAttention.map((snapshot) => (
                  <MemberOversightCard
                    key={snapshot.member.member_id}
                    snapshot={snapshot}
                    email={
                      emailsByMemberId.get(snapshot.member.member_id) ?? null
                    }
                    assignTaskPath={assignTaskPath}
                  />
                ))}
              </div>
            )}
          </section>

          <section
            className="task-oversight-section"
            aria-labelledby="everyone-else-heading"
          >
            <div className="task-oversight-section-header task-oversight-section-header--controls">
              <div>
                <h2
                  id="everyone-else-heading"
                  className="task-oversight-section-title"
                >
                  Everyone Else
                </h2>
                <p className="task-oversight-section-desc">
                  On track, completed, or without assignments
                </p>
              </div>
              <div className="task-oversight-controls">
                <label className="task-oversight-control">
                  <span className="sr-only">Search members</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search members"
                    className="task-oversight-input"
                    aria-label="Search members"
                  />
                </label>
                <label className="task-oversight-control">
                  Assignee
                  <select
                    aria-label="Assignee"
                    value={assigneeFilter}
                    onChange={(event) =>
                      setAssigneeFilter(
                        event.target.value as AssigneeCategoryFilter,
                      )
                    }
                    className="task-oversight-select"
                  >
                    {ASSIGNEE_CATEGORY_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="task-oversight-control">
                  Sort by
                  <select
                    aria-label="Sort by"
                    value={activeSort}
                    onChange={(event) =>
                      setActiveSort(
                        event.target.value as ActiveAssignmentsSort,
                      )
                    }
                    className="task-oversight-select"
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

            {everyoneElse.length === 0 ? (
              <p className="task-oversight-empty">
                {assigneeFilter === "all" && !search && !healthFilter
                  ? "No other members to show."
                  : "No members match these filters."}
              </p>
            ) : (
              <div className="task-oversight-card-list">
                {everyoneElse.map((snapshot) => (
                  <MemberOversightCard
                    key={snapshot.member.member_id}
                    snapshot={snapshot}
                    email={
                      emailsByMemberId.get(snapshot.member.member_id) ?? null
                    }
                    assignTaskPath={assignTaskPath}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
