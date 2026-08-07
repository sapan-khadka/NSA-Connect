import { useMemo } from "react";
import { Link } from "react-router";

import { Avatar } from "../../design-system/components/Avatar";
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

type MemberDeadlineGroup = {
  memberId: number;
  fullName: string;
  openTasks: EventTaskResponse[];
  openCount: number;
  overdueCount: number;
  earliestDue: string;
};

type HomeUpcomingDeadlinesProps = {
  personalTasks?: EventTaskResponse[];
  overviewMembers?: TaskOverviewMember[];
  useOversight?: boolean;
  isLoading?: boolean;
  tasksPath: string;
  /** Max personal deadline rows (non-team view). */
  limit?: number;
  /** Max members shown in team roster. */
  memberLimit?: number;
  /** Max open tasks listed under each member. */
  tasksPerMember?: number;
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

function formatDueLabel(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "No due date";
  }
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) {
    return "No due date";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function sortTasks(tasks: EventTaskResponse[]): EventTaskResponse[] {
  return [...tasks].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) {
      return a.is_overdue ? -1 : 1;
    }
    return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  });
}

function sortDeadlines(rows: DeadlineRow[]): DeadlineRow[] {
  return [...rows].sort((a, b) => {
    if (a.task.is_overdue !== b.task.is_overdue) {
      return a.task.is_overdue ? -1 : 1;
    }
    return (a.task.due_date ?? "9999").localeCompare(b.task.due_date ?? "9999");
  });
}

function buildMemberGroups(
  overviewMembers: TaskOverviewMember[],
): MemberDeadlineGroup[] {
  const groups: MemberDeadlineGroup[] = [];

  for (const member of overviewMembers) {
    const openTasks = sortTasks(
      member.tasks.filter(
        (task) => !task.is_complete && task.status !== "done",
      ),
    );
    if (openTasks.length === 0) {
      continue;
    }
    const overdueCount = openTasks.filter((task) => task.is_overdue).length;
    groups.push({
      memberId: member.member_id,
      fullName: member.full_name,
      openTasks,
      openCount: openTasks.length,
      overdueCount,
      earliestDue: openTasks[0]?.due_date ?? "9999",
    });
  }

  return groups.sort((a, b) => {
    if (a.overdueCount !== b.overdueCount) {
      return b.overdueCount - a.overdueCount;
    }
    if (a.openCount !== b.openCount) {
      return b.openCount - a.openCount;
    }
    const due = a.earliestDue.localeCompare(b.earliestDue);
    if (due !== 0) {
      return due;
    }
    return a.fullName.localeCompare(b.fullName);
  });
}

/**
 * Board view: roster of members with open assigned work.
 * Personal view: compact deadline list for the signed-in member.
 */
export function HomeUpcomingDeadlines({
  personalTasks = [],
  overviewMembers = [],
  useOversight = false,
  isLoading = false,
  tasksPath,
  limit = 5,
  memberLimit = 12,
  tasksPerMember = 6,
}: HomeUpcomingDeadlinesProps) {
  const personalRows = useMemo(() => {
    if (useOversight) {
      return [] as DeadlineRow[];
    }
    const personal = personalTasks
      .filter((task) => !task.is_complete && task.status !== "done")
      .map((task) => ({
        task,
        assignee: task.assignee_name || "You",
      }));
    return sortDeadlines(personal).slice(0, limit);
  }, [useOversight, personalTasks, limit]);

  const memberGroups = useMemo(() => {
    if (!useOversight) {
      return [] as MemberDeadlineGroup[];
    }
    return buildMemberGroups(overviewMembers).slice(0, memberLimit);
  }, [useOversight, overviewMembers, memberLimit]);

  const totalMembersWithWork = useMemo(() => {
    if (!useOversight) {
      return 0;
    }
    /* Count uses same builder; cheap relative to list UI. */
    return overviewMembers.reduce((count, member) => {
      const hasOpen = member.tasks.some(
        (task) => !task.is_complete && task.status !== "done",
      );
      return hasOpen ? count + 1 : count;
    }, 0);
  }, [useOversight, overviewMembers]);

  const linkTo = useOversight ? "/events/oversight" : tasksPath;
  const title = useOversight ? "Team Deadlines" : "My Deadlines";
  const ariaLabel = useOversight ? "Team deadlines" : "My deadlines";
  const hiddenMembers = Math.max(0, totalMembersWithWork - memberGroups.length);

  return (
    <HomeCard
      padding="sm"
      className="home-surface-quiet home-upcoming-deadlines home-task-surface"
      aria-label={ariaLabel}
    >
      <div className="home-task-header">
        <div className="home-task-header-left">
          <h2 className="home-panel-title">{title}</h2>
          {useOversight && !isLoading && totalMembersWithWork > 0 ? (
            <span className="home-deadline-count">
              {totalMembersWithWork}{" "}
              {totalMembersWithWork === 1 ? "member" : "members"}
            </span>
          ) : null}
        </div>
        <ArrowLink to={linkTo}>View all</ArrowLink>
      </div>

      {isLoading ? (
        <p className="home-activity-empty">Loading…</p>
      ) : useOversight ? (
        memberGroups.length === 0 ? (
          <p className="home-activity-empty">No open team assignments</p>
        ) : (
          <ul className="home-deadline-roster">
            {memberGroups.map((group) => {
              const shown = group.openTasks.slice(0, tasksPerMember);
              const moreCount = group.openCount - shown.length;
              return (
                <li key={group.memberId} className="home-deadline-person">
                  <div className="home-deadline-person__head">
                    <Avatar
                      name={group.fullName}
                      memberId={group.memberId}
                      size="sm"
                      className="home-deadline-person__avatar"
                    />
                    <div className="home-deadline-person__identity">
                      <Link
                        to={`/members/${group.memberId}`}
                        className="home-deadline-person__name"
                      >
                        {group.fullName}
                      </Link>
                      <p className="home-deadline-person__stats">
                        <span>
                          {group.openCount} open
                          {group.openCount === 1 ? " task" : " tasks"}
                        </span>
                        {group.overdueCount > 0 ? (
                          <span className="home-deadline-person__overdue">
                            {group.overdueCount} overdue
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  <ul className="home-deadline-person__tasks">
                    {shown.map((task) => {
                      const date = dateParts(task.due_date);
                      const eventName = task.event_name?.trim();
                      return (
                        <li key={task.id}>
                          <Link
                            to={linkTo}
                            className={[
                              "home-deadline-task",
                              task.is_overdue ? "is-overdue" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <time
                              className="home-deadline-task__date"
                              dateTime={task.due_date ?? undefined}
                              title={formatDueLabel(task.due_date)}
                            >
                              <span className="home-deadline-task__month">
                                {date.month}
                              </span>
                              <span className="home-deadline-task__day">
                                {date.day}
                              </span>
                            </time>
                            <span className="home-deadline-task__copy">
                              <span className="home-deadline-task__title">
                                {getTaskDisplayName(task)}
                              </span>
                              {eventName ? (
                                <span className="home-deadline-task__event">
                                  {eventName}
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {moreCount > 0 ? (
                    <Link to={linkTo} className="home-deadline-person__more">
                      +{moreCount} more for {group.fullName.split(/\s+/)[0]}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : personalRows.length === 0 ? (
        <p className="home-activity-empty">No open deadlines</p>
      ) : (
        <ul className="home-deadline-list">
          {personalRows.map(({ task }) => {
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
                    <span className="home-deadline-date__month">
                      {date.month}
                    </span>
                    <span className="home-deadline-date__day">{date.day}</span>
                  </time>
                  <span className="home-deadline-copy">
                    <span className="home-deadline-title">
                      {getTaskDisplayName(task)}
                    </span>
                    <span className="home-deadline-meta">
                      {task.event_name?.trim() || "Personal task"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {useOversight && !isLoading && hiddenMembers > 0 ? (
        <Link to={linkTo} className="home-deadline-footer">
          +{hiddenMembers} more{" "}
          {hiddenMembers === 1 ? "member" : "members"} with open work
        </Link>
      ) : null}
    </HomeCard>
  );
}
