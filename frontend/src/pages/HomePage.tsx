import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { EventRsvpButton } from "../components/EventRsvpButton";
import { HomeHeroBrand } from "../components/AppLogo";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMyEventTasks } from "../lib/event-tasks-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import {
  cancelEventRsvp,
  fetchUpcomingEvents,
  rsvpToEvent,
  type EventResponse,
} from "../lib/events-api";
import { fetchPendingFinanceChangeRequests } from "../lib/finance-api";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  getMyTasksPath,
  getTaskDisplayName,
  summarizeMyTasks,
} from "../lib/home-tasks";
import { fetchPendingMembers } from "../lib/members-api";
import {
  canAccessFinance,
  canViewMemberDirectory,
  canViewTaskOversight,
  getDashboardPath,
  isRoleAtLeast,
} from "../lib/roles";

type HomeAlert = {
  id: string;
  message: string;
  to: string;
  label: string;
};

type QuickLink = {
  title: string;
  description: string;
  to: string;
  featured?: boolean;
};

function QuickLinkCard({ title, description, to, featured = false }: QuickLink) {
  return (
    <Link
      to={to}
      className={[
        "block rounded-md border px-4 py-3 transition-all",
        featured
          ? "border-accent/30 bg-gradient-to-br from-accent/10 to-white hover:border-accent hover:shadow-md"
          : "border-gray-200 hover:border-accent hover:bg-accent/5",
      ].join(" ")}
    >
      <p className="font-medium text-primary">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </Link>
  );
}

function buildQuickLinks(member: MemberResponse): QuickLink[] {
  const links: QuickLink[] = [
    {
      title: "Events calendar",
      description: "Browse the month, RSVP, and see event details.",
      to: "/events",
      featured: true,
    },
    {
      title: "AI assistant",
      description: "Ask about events, tasks, and NSA operations.",
      to: "/assistant",
    },
    {
      title: "Your profile",
      description: "Update contact info and view your membership details.",
      to: "/profile",
    },
    {
      title: "Dashboard",
      description: "Open your role workspace for deeper management tools.",
      to: getDashboardPath(member.role),
    },
  ];

  if (isRoleAtLeast(member.role, "board")) {
    links.push(
      {
        title: "Upcoming events hub",
        description: "Manage tasks, budgets, and progress per event.",
        to: "/events/upcoming",
      },
      {
        title: "Task board",
        description: "Drag checklist tasks across To do, In progress, and Done.",
        to: "/board/tasks",
      },
    );
  }

  if (canViewMemberDirectory(member.role)) {
    links.push({
      title: "Member directory",
      description: "Browse and search all NSA Connect members.",
      to: "/members",
    });
  }

  if (canViewTaskOversight(member.role, member.position)) {
    links.push({
      title: "Task oversight",
      description: "See completion progress across the team.",
      to: "/board/task-oversight",
    });
  }

  if (canAccessFinance(member.role)) {
    links.push({
      title: "Finance",
      description: "Review budgets, dues, and treasury activity.",
      to: "/finance",
    });
  }

  return links;
}

function PublicHomeView() {
  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8 md:p-10">
        <HomeHeroBrand
          eyebrow="Nepalese Students' Association · SEMO"
          title="NSA Connect"
          description="Log in or create an account with your @semo.edu email to access events, tasks, and member tools."
          align="center"
          actions={
            <>
              <Link
                to="/login"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:border-accent hover:bg-accent/5"
              >
                Create account
              </Link>
            </>
          }
        />
      </section>
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const [nextEvents, setNextEvents] = useState<EventResponse[]>([]);
  const [featuredEvent, setFeaturedEvent] = useState<EventResponse | null>(null);
  const [tasksSummary, setTasksSummary] = useState(
    summarizeMyTasks([]),
  );
  const [alerts, setAlerts] = useState<HomeAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const upcomingPromise = fetchUpcomingEvents({ limit: 3 });
        const tasksPromise = fetchMyEventTasks().catch(() => ({
          tasks: [],
          total: 0,
        }));

        const pendingMembersPromise = isRoleAtLeast(member.role, "board")
          ? fetchPendingMembers().catch(() => ({ members: [], total: 0 }))
          : Promise.resolve(null);

        const financePendingPromise = isRoleAtLeast(member.role, "treasurer")
          ? fetchPendingFinanceChangeRequests().catch(() => ({
              requests: [],
              total: 0,
            }))
          : Promise.resolve(null);

        const [upcoming, tasksResult, pendingMembers, financePending] =
          await Promise.all([
            upcomingPromise,
            tasksPromise,
            pendingMembersPromise,
            financePendingPromise,
          ]);

        if (cancelled) {
          return;
        }

        setNextEvents(upcoming.events);
        setFeaturedEvent(upcoming.events[0] ?? null);
        setTasksSummary(summarizeMyTasks(tasksResult.tasks));

        const nextAlerts: HomeAlert[] = [];
        const summary = summarizeMyTasks(tasksResult.tasks);

        if (summary.overdueCount > 0) {
          nextAlerts.push({
            id: "overdue-tasks",
            message: `${summary.overdueCount} assigned task${summary.overdueCount === 1 ? "" : "s"} overdue`,
            to: getMyTasksPath(member.role),
            label: "Review tasks",
          });
        }

        if (pendingMembers && pendingMembers.total > 0) {
          nextAlerts.push({
            id: "pending-members",
            message: `${pendingMembers.total} member signup${pendingMembers.total === 1 ? "" : "s"} waiting for approval`,
            to: "/members?tab=pending",
            label: "Review signups",
          });
        }

        if (financePending && financePending.total > 0) {
          nextAlerts.push({
            id: "finance-pending",
            message: `${financePending.total} finance change request${financePending.total === 1 ? "" : "s"} need your review`,
            to: "/finance",
            label: "Open finance",
          });
        }

        setAlerts(nextAlerts);
      } catch (caught) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(caught));
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
  }, [member]);

  async function handleRsvp() {
    if (!featuredEvent) {
      return;
    }

    setRsvpLoading(true);
    try {
      const status = await rsvpToEvent(featuredEvent.id);
      setFeaturedEvent((current) =>
        current
          ? {
              ...current,
              rsvp_count: status.rsvp_count,
              current_member_has_rsvped: status.current_member_has_rsvped,
            }
          : current,
      );
      setNextEvents((current) =>
        current.map((event) =>
          event.id === featuredEvent.id
            ? {
                ...event,
                rsvp_count: status.rsvp_count,
                current_member_has_rsvped: status.current_member_has_rsvped,
              }
            : event,
        ),
      );
    } finally {
      setRsvpLoading(false);
    }
  }

  async function handleCancelRsvp() {
    if (!featuredEvent) {
      return;
    }

    setRsvpLoading(true);
    try {
      const status = await cancelEventRsvp(featuredEvent.id);
      setFeaturedEvent((current) =>
        current
          ? {
              ...current,
              rsvp_count: status.rsvp_count,
              current_member_has_rsvped: status.current_member_has_rsvped,
            }
          : current,
      );
      setNextEvents((current) =>
        current.map((event) =>
          event.id === featuredEvent.id
            ? {
                ...event,
                rsvp_count: status.rsvp_count,
                current_member_has_rsvped: status.current_member_has_rsvped,
              }
            : event,
        ),
      );
    } finally {
      setRsvpLoading(false);
    }
  }

  const quickLinks = buildQuickLinks(member);
  const tasksPath = getMyTasksPath(member.role);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-white p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Home
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">
          Welcome back, {member.full_name}
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          Your daily check-in for NSA events, assigned work, and quick
          navigation across the app.
        </p>
      </section>

      {alerts.length > 0 ? (
        <section
          aria-label="Needs attention"
          className="rounded-lg border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">
            Needs attention
          </h2>
          <ul className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200/80 bg-white px-4 py-3"
              >
                <p className="text-sm font-medium text-amber-950">
                  {alert.message}
                </p>
                <Link
                  to={alert.to}
                  className="text-sm font-semibold text-accent hover:text-accent-hover"
                >
                  {alert.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">Next event</h2>
              <p className="mt-1 text-sm text-gray-500">
                The nearest upcoming event on the NSA calendar.
              </p>
            </div>
            <Link
              to="/events"
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              Calendar →
            </Link>
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-gray-500">Loading events…</p>
          ) : null}

          {!isLoading && !featuredEvent ? (
            <p className="mt-6 rounded-md border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
              No upcoming events right now.
            </p>
          ) : null}

          {!isLoading && featuredEvent ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-md border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-primary">
                      {featuredEvent.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatEventDateTime(featuredEvent.starts_at)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[featuredEvent.event_type]}`}
                  >
                    {EVENT_TYPE_LABELS[featuredEvent.event_type]}
                  </span>
                </div>
                {featuredEvent.description ? (
                  <p className="mt-3 line-clamp-3 text-sm text-gray-600">
                    {featuredEvent.description}
                  </p>
                ) : null}
              </div>

              <EventRsvpButton
                hasRsvped={featuredEvent.current_member_has_rsvped}
                rsvpCount={featuredEvent.rsvp_count}
                canRsvp
                loading={rsvpLoading}
                onRsvp={() => void handleRsvp()}
                onCancelRsvp={() => void handleCancelRsvp()}
              />

              {nextEvents.length > 1 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Also coming up
                  </p>
                  <ul className="mt-2 space-y-2">
                    {nextEvents.slice(1).map((event) => (
                      <li
                        key={event.id}
                        className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-primary">
                          {event.name}
                        </span>
                        <span className="text-gray-500">
                          {" "}
                          · {formatEventDateTime(event.starts_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-primary">Your work</h2>
              <p className="mt-1 text-sm text-gray-500">
                Assigned event tasks and volunteer commitments.
              </p>
            </div>
            <Link
              to={tasksPath}
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              View all →
            </Link>
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-gray-500">Loading tasks…</p>
          ) : null}

          {!isLoading && tasksSummary.openCount === 0 ? (
            <p className="mt-6 rounded-md border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
              No open tasks assigned to you. You&apos;re all caught up.
            </p>
          ) : null}

          {!isLoading && tasksSummary.openCount > 0 ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Open tasks
                  </p>
                  <p className="mt-2 text-3xl font-bold text-primary">
                    {tasksSummary.openCount}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Overdue
                  </p>
                  <p
                    className={[
                      "mt-2 text-3xl font-bold",
                      tasksSummary.overdueCount > 0
                        ? "text-red-700"
                        : "text-primary",
                    ].join(" ")}
                  >
                    {tasksSummary.overdueCount}
                  </p>
                </div>
              </div>

              {tasksSummary.nextTask ? (
                <div className="rounded-md border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Up next
                  </p>
                  <p className="mt-2 font-medium text-primary">
                    {getTaskDisplayName(tasksSummary.nextTask)}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {tasksSummary.nextTask.event_name}
                  </p>
                  {tasksSummary.nextTask.due_date ? (
                    <p className="mt-1 text-sm text-gray-500">
                      Due {formatEventDateTime(tasksSummary.nextTask.due_date)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">No due date</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-primary">Quick links</h2>
        <p className="mt-1 text-sm text-gray-500">
          Jump to the parts of NSA Connect you use most.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {quickLinks.map((link) => (
            <li key={link.to + link.title}>
              <QuickLinkCard {...link} />
            </li>
          ))}
        </ul>
      </section>

      {import.meta.env.DEV ? <DevHealthCheck /> : null}
    </div>
  );
}

function DevHealthCheck() {
  const [health, setHealth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    fetch("/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as { status: string };
        if (!controller.signal.aborted) {
          setHealth(data.status);
        }
      })
      .catch((caught: Error) => {
        if (controller.signal.aborted) {
          return;
        }
        if (caught.name === "AbortError") {
          setError("Unavailable (timeout)");
          return;
        }
        setError(caught.message);
      })
      .finally(() => window.clearTimeout(timeoutId));

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-left text-sm text-gray-500">
      <p className="font-semibold uppercase tracking-wide">Dev: API status</p>
      {health ? <p className="mt-1 text-green-700">Backend: {health}</p> : null}
      {error ? <p className="mt-1 text-red-600">Backend: {error}</p> : null}
      {!health && !error ? (
        <p className="mt-1 text-gray-400">Checking backend…</p>
      ) : null}
    </section>
  );
}

export function HomePage() {
  const { member, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!isAuthenticated || !member) {
    return <PublicHomeView />;
  }

  return <MemberHomeView member={member} />;
}
