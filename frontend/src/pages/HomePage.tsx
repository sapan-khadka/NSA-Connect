import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Archive,
  ArrowRight,
  ClipboardList,
  ListTodo,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { EventRsvpButton } from "../components/EventRsvpButton";
import { CoverBanner } from "../components/CoverBanner";
import { HomeHeroBrand } from "../components/AppLogo";
import { HomeProfileCard } from "../components/HomeProfileCard";
import { HomeShortcutPills } from "../components/HomeShortcutPills";
import { ArrowLink } from "../components/ui/ArrowLink";
import { EmptyState } from "../components/ui/EmptyState";
import { HomeCard } from "../components/ui/HomeCard";
import { SectionLabel } from "../components/ui/SectionLabel";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMyEventTasks } from "../lib/event-tasks-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { applyRsvpStatus } from "../lib/event-rsvp";
import {
  fetchUpcomingEvents,
  updateEventRsvp,
  type EventResponse,
  type RsvpStatus,
} from "../lib/events-api";
import { fetchPendingFinanceChangeRequests, fetchMyFinanceChangeRequestSummary } from "../lib/finance-api";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  getMyTasksPath,
  getTaskDisplayName,
  summarizeMyTasks,
} from "../lib/home-tasks";
import { eventDetailPath } from "../lib/event-links";
import { fetchPendingMembers } from "../lib/members-api";
import { fetchMeetings, type MeetingSummary } from "../lib/meetings-api";
import {
  canAccessFinance,
  canViewMemberDirectory,
  canViewTaskOversight,
  isRoleAtLeast,
} from "../lib/roles";

type HomeAlert = {
  id: string;
  count: number;
  label: string;
  message: string;
  to: string;
  actionLabel: string;
};

const ALERT_ICONS: Record<string, LucideIcon> = {
  "overdue-tasks": AlertCircle,
  "pending-members": Users,
  "finance-pending": Wallet,
};

type QuickLink = {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

function QuickLinkCard({ title, description, to, icon: Icon }: QuickLink) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col ds-card ds-card-interactive px-4 py-4"
    >
      <Icon
        className="h-[18px] w-[18px] text-accent transition-colors group-hover:text-primary"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="mt-2 font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-label">{description}</p>
    </Link>
  );
}

function buildQuickLinks(member: MemberResponse): QuickLink[] {
  const links: QuickLink[] = [];

  if (isRoleAtLeast(member.role, "board")) {
    links.push({
      title: "Past events",
      description: "Review completed events and finance close-out status.",
      to: "/events/past",
      icon: Archive,
    });
  }

  if (canViewMemberDirectory(member.role)) {
    links.push({
      title: "Member directory",
      description: "Browse and search all NSA Connect members.",
      to: "/members",
      icon: Users,
    });
  }

  if (canViewTaskOversight(member.role, member.position)) {
    links.push({
      title: "Task oversight",
      description: "See completion progress across the team.",
      to: "/events/oversight",
      icon: ClipboardList,
    });
  }

  if (canAccessFinance(member.role)) {
    links.push({
      title: "Finance",
      description: "Review budgets, dues, and treasury activity.",
      to: "/finance",
      icon: Wallet,
    });
  }

  if (member.role === "general") {
    links.push({
      title: "AI assistant",
      description: "Ask about events, tasks, and NSA operations.",
      to: "/assistant",
      icon: Sparkles,
    });
  }

  return links;
}

function PublicHomeView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <CoverBanner />
      <HomeHeroBrand
        eyebrow="Namaste — welcome to NSA Connect"
        title="NSA Connect"
        description="Log in or create an account with your @semo.edu email to access events, tasks, and member tools."
        align="center"
        actions={
          <>
            <Link
              to="/login"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-foreground transition hover:border-accent hover:bg-accent/5"
            >
              Create account
            </Link>
          </>
        }
      />
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
  const [latestMeeting, setLatestMeeting] = useState<MeetingSummary | null>(null);
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

        const myFinanceRequestsPromise = isRoleAtLeast(member.role, "treasurer")
          ? fetchMyFinanceChangeRequestSummary().catch(() => ({
              pending_count: 0,
              recently_rejected_count: 0,
              recently_approved_count: 0,
            }))
          : Promise.resolve(null);

        const meetingsPromise = isRoleAtLeast(member.role, "board")
          ? fetchMeetings().catch(() => ({ meetings: [], total: 0 }))
          : Promise.resolve(null);

        const [upcoming, tasksResult, pendingMembers, financePending, myFinanceRequests, meetingsResult] =
          await Promise.all([
            upcomingPromise,
            tasksPromise,
            pendingMembersPromise,
            financePendingPromise,
            myFinanceRequestsPromise,
            meetingsPromise,
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
            count: summary.overdueCount,
            label: "Overdue tasks",
            message: `Assigned task${summary.overdueCount === 1 ? "" : "s"} past due`,
            to: getMyTasksPath(member.role),
            actionLabel: "Review tasks",
          });
        }

        if (pendingMembers && pendingMembers.total > 0) {
          nextAlerts.push({
            id: "pending-members",
            count: pendingMembers.total,
            label: "Pending signups",
            message: `Member signup${pendingMembers.total === 1 ? "" : "s"} waiting for approval`,
            to: "/members?tab=pending",
            actionLabel: "Review signups",
          });
        }

        if (financePending && financePending.total > 0) {
          nextAlerts.push({
            id: "finance-pending",
            count: financePending.total,
            label: "Finance reviews",
            message: `Finance change request${financePending.total === 1 ? "" : "s"} need your review`,
            to: "/finance",
            actionLabel: "Open finance",
          });
        }

        if (myFinanceRequests && myFinanceRequests.pending_count > 0) {
          nextAlerts.push({
            id: "finance-my-pending",
            count: myFinanceRequests.pending_count,
            label: "Your finance requests",
            message: `Your finance change request${myFinanceRequests.pending_count === 1 ? " is" : "s are"} awaiting approval`,
            to: "/finance",
            actionLabel: "View status",
          });
        }

        if (myFinanceRequests && myFinanceRequests.recently_rejected_count > 0) {
          nextAlerts.push({
            id: "finance-my-rejected",
            count: myFinanceRequests.recently_rejected_count,
            label: "Finance request rejected",
            message: `Finance change request${myFinanceRequests.recently_rejected_count === 1 ? " was" : "s were"} rejected in the last 7 days`,
            to: "/finance",
            actionLabel: "View details",
          });
        }

        if (myFinanceRequests && myFinanceRequests.recently_approved_count > 0) {
          nextAlerts.push({
            id: "finance-my-approved",
            count: myFinanceRequests.recently_approved_count,
            label: "Finance request approved",
            message: `Finance change request${myFinanceRequests.recently_approved_count === 1 ? " was" : "s were"} approved in the last 7 days`,
            to: "/finance",
            actionLabel: "View details",
          });
        }

        setAlerts(nextAlerts);

        if (meetingsResult) {
          const recordedMeeting = meetingsResult.meetings.find(
            (meeting) => meeting.has_attendance || meeting.has_minutes,
          );
          setLatestMeeting(recordedMeeting ?? meetingsResult.meetings[0] ?? null);
        } else {
          setLatestMeeting(null);
        }
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

  async function handleRsvpStatusChange(status: RsvpStatus) {
    if (!featuredEvent) {
      return;
    }

    const snapshot = featuredEvent;
    setRsvpLoading(true);
    setFeaturedEvent((current) =>
      current ? { ...current, current_member_rsvp_status: status } : current,
    );
    setNextEvents((current) =>
      current.map((event) =>
        event.id === featuredEvent.id
          ? { ...event, current_member_rsvp_status: status }
          : event,
      ),
    );

    try {
      const response = await updateEventRsvp(featuredEvent.id, status);
      setFeaturedEvent((current) =>
        current ? applyRsvpStatus(current, response) : current,
      );
      setNextEvents((current) =>
        current.map((event) =>
          event.id === featuredEvent.id ? applyRsvpStatus(event, response) : event,
        ),
      );
    } catch {
      setFeaturedEvent(snapshot);
      setNextEvents((current) =>
        current.map((event) =>
          event.id === snapshot.id
            ? {
                ...event,
                current_member_rsvp_status: snapshot.current_member_rsvp_status,
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
    <div className="space-y-6">
      <CoverBanner />

      <div>
        <h1 className="text-2xl font-light tracking-headline text-foreground md:text-3xl">
          Welcome back,{" "}
          <span className="text-foreground">{member.full_name}</span>
        </h1>
        <p className="mt-1 text-sm text-label">
          Your daily check-in for NSA events and assigned work.
        </p>
        <HomeShortcutPills member={member} />
      </div>

      {alerts.length > 0 ? (
        <section aria-label="Needs attention" className="ds-card p-4">
          <SectionLabel>Needs attention</SectionLabel>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
              <li key={alert.id} className="ds-card-nested p-3">
                <SectionLabel
                  icon={ALERT_ICONS[alert.id]}
                  iconClassName={
                    alert.id === "overdue-tasks"
                      ? "h-4 w-4 shrink-0 text-overdue"
                      : undefined
                  }
                  className={alert.id === "overdue-tasks" ? "text-overdue" : undefined}
                >
                  {alert.label}
                </SectionLabel>
                <p
                  className={
                    alert.id === "overdue-tasks"
                      ? "ds-stat-overdue-chip"
                      : "ds-stat-value"
                  }
                >
                  {alert.count}
                </p>
                <p className="mt-0.5 text-sm text-label">{alert.message}</p>
                <div className="mt-2">
                  <ArrowLink to={alert.to}>{alert.actionLabel}</ArrowLink>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {latestMeeting ? (
        <HomeCard padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="ds-section-label">
                Board meetings
              </h2>
              <p className="mt-1 font-medium text-foreground">{latestMeeting.event_name}</p>
              <p className="mt-1 text-sm text-label">
                {latestMeeting.has_attendance || latestMeeting.has_minutes
                  ? "Attendance or minutes are on file for this meeting."
                  : "Scheduled board meeting — open to view the agenda."}
              </p>
            </div>
            <ArrowLink to={`/events/meetings/${latestMeeting.event_id}`}>
              View meeting
            </ArrowLink>
          </div>
        </HomeCard>
      ) : null}

      {loadError ? (
        <div role="alert" className="ds-alert-banner">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <HomeCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-light tracking-subhead text-foreground">Next event</h2>
              <p className="mt-1 text-sm text-label">
                The nearest upcoming event on the NSA calendar.
              </p>
            </div>
            <ArrowLink to="/events/calendar">Calendar</ArrowLink>
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-label">Loading events…</p>
          ) : null}

          {!isLoading && !featuredEvent ? (
            <EmptyState
              icon="calendar"
              title="No upcoming events"
              description="No events yet — check back before the next festival."
            />
          ) : null}

          {!isLoading && featuredEvent ? (
            <div className="mt-6 space-y-4">
              <div className="ds-card-nested p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to={eventDetailPath(featuredEvent.id)}
                      className="text-lg font-light tracking-subhead text-foreground hover:text-accent"
                    >
                      {featuredEvent.name}
                    </Link>
                    <p className="mt-1 text-sm text-label">
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
                  <p className="mt-3 line-clamp-3 text-sm text-label">
                    {featuredEvent.description}
                  </p>
                ) : null}
              </div>

              <EventRsvpButton
                currentStatus={featuredEvent.current_member_rsvp_status}
                canRsvp
                loading={rsvpLoading}
                onStatusChange={(status) => void handleRsvpStatusChange(status)}
              />

              <ArrowLink to={eventDetailPath(featuredEvent.id)}>
                View event details
              </ArrowLink>

              {nextEvents.length > 1 ? (
                <div>
                  <p className="ds-section-label">
                    Also coming up
                  </p>
                  <ul className="mt-2 space-y-2">
                    {nextEvents.slice(1).map((event) => (
                      <li
                        key={event.id}
                        className="ds-card-nested px-3 py-2 text-sm"
                      >
                        <Link
                          to={eventDetailPath(event.id)}
                          className="font-medium text-foreground hover:text-accent"
                        >
                          {event.name}
                        </Link>
                        <span className="text-label">
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
        </HomeCard>

        <HomeCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-light tracking-subhead text-foreground">
                {member.role === "general" ? "Assigned work" : "Your work"}
              </h2>
              <p className="mt-1 text-sm text-label">
                Assigned event tasks and volunteer commitments.
              </p>
            </div>
            <ArrowLink to={tasksPath}>View all</ArrowLink>
          </div>

          {isLoading ? (
            <p className="mt-6 text-sm text-label">Loading tasks…</p>
          ) : null}

          {!isLoading && tasksSummary.openCount === 0 ? (
            <EmptyState
              icon="check"
              title="No open tasks assigned"
              description="You're all caught up."
            />
          ) : null}

          {!isLoading && tasksSummary.openCount > 0 ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="ds-stat-tile">
                  <SectionLabel icon={ListTodo}>Open tasks</SectionLabel>
                  <p className="ds-stat-value">{tasksSummary.openCount}</p>
                </div>
                <div className="ds-stat-tile">
                  <SectionLabel
                    icon={AlertCircle}
                    iconClassName="h-4 w-4 shrink-0 text-overdue"
                    className="text-overdue"
                  >
                    Overdue
                  </SectionLabel>
                  <p className="ds-stat-overdue-chip">
                    {tasksSummary.overdueCount}
                  </p>
                </div>
              </div>

              {tasksSummary.nextTask ? (
                <div className="ds-card-nested p-4">
                  <SectionLabel icon={ArrowRight}>Up next</SectionLabel>
                  <p className="mt-2 font-medium text-foreground">
                    {getTaskDisplayName(tasksSummary.nextTask)}
                  </p>
                  <p className="mt-1 text-sm text-label">
                    {tasksSummary.nextTask.event_name}
                  </p>
                  {tasksSummary.nextTask.due_date ? (
                    <p className="mt-1 text-sm text-label">
                      Due {formatEventDateTime(tasksSummary.nextTask.due_date)}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-label">No due date</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </HomeCard>
      </div>

      <HomeProfileCard member={member} />

      {quickLinks.length > 0 ? (
        <HomeCard>
          <h2 className="text-lg font-light tracking-subhead text-foreground">More for your role</h2>
          <p className="mt-1 text-sm text-label">
            Board and leadership tools not shown in the shortcuts above.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <li key={link.to + link.title}>
                <QuickLinkCard {...link} />
              </li>
            ))}
          </ul>
        </HomeCard>
      ) : null}
    </div>
  );
}

export function HomePage() {
  const { member, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-sm text-label">Loading…</p>;
  }

  if (!isAuthenticated || !member) {
    return <PublicHomeView />;
  }

  return <MemberHomeView member={member} />;
}
