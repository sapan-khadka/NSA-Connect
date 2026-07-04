import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Archive,
  ClipboardList,
  ListTodo,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { EventRsvpButton } from "../components/EventRsvpButton";
import { CoverBanner } from "../components/CoverBanner";
import { HomeFinanceQuickActions } from "../components/HomeFinanceQuickActions";
import { HomeHeroBrand } from "../components/AppLogo";
import { HomeProfileCard } from "../components/HomeProfileCard";
import { LogFinanceEntryForm } from "../components/LogFinanceEntryForm";
import { RecentMemoriesStrip } from "../components/RecentMemoriesStrip";
import { ArrowLink } from "../components/ui/ArrowLink";
import { EmptyState } from "../components/ui/EmptyState";
import { HomeCard } from "../components/ui/HomeCard";
import { Modal } from "../components/ui/Modal";
import { SectionLabel } from "../components/ui/SectionLabel";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMyEventTasks } from "../lib/event-tasks-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import { applyRsvpStatus, formatCompactAttendeeSummary } from "../lib/event-rsvp";
import {
  fetchEventAttendees,
  fetchEvents,
  fetchUpcomingEvents,
  updateEventRsvp,
  type EventResponse,
  type RsvpStatus,
} from "../lib/events-api";
import { isEventFinanceEditable } from "../lib/event-finance";
import { fetchPendingFinanceChangeRequests, fetchMyFinanceChangeRequestSummary } from "../lib/finance-api";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  buildHomeActivities,
  RECENT_ACTIVITY_FOOTNOTE,
  type HomeActivity,
} from "../lib/home-activities";
import {
  getMyTasksPath,
  getTaskDisplayName,
  summarizeMyTasks,
} from "../lib/home-tasks";
import { eventDetailPath } from "../lib/event-links";
import { fetchPendingMembers } from "../lib/members-api";
import { fetchMeetings, type MeetingSummary } from "../lib/meetings-api";
import { fetchRecentMemories, type RecentMemoriesPreview } from "../lib/recent-memories";
import {
  canAccessFinance,
  canManageTreasury,
  canViewMemberDirectory,
  canViewTaskOversight,
  isRoleAtLeast,
} from "../lib/roles";

const HOME_ACTIVITY_MAX_HEIGHT_CLASS = "max-h-64";

type QuickLink = {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

function findNextNonMeetingEvent(events: EventResponse[]): EventResponse | null {
  return events.find((event) => event.event_type !== "meeting") ?? null;
}

function findNextBoardMeeting(meetings: MeetingSummary[]): MeetingSummary | null {
  return (
    meetings
      .filter((meeting) => !meeting.is_past)
      .sort(
        (left, right) =>
          new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
      )[0] ?? null
  );
}

function QuickLinkCard({ title, description, to, icon: Icon }: QuickLink) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col ds-card ds-card-interactive p-[0.9rem]"
    >
      <Icon
        className="h-[18px] w-[18px] text-accent transition-colors group-hover:text-primary"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="mt-2 text-[13px] font-medium text-foreground">{title}</p>
      <p className="mt-1 line-clamp-1 text-xs text-label">{description}</p>
    </Link>
  );
}

function ActivityRow({
  activity,
  showDividerAbove = false,
}: {
  activity: HomeActivity;
  showDividerAbove?: boolean;
}) {
  const isRecent = activity.kind === "recent";
  const dotClass = isRecent
    ? "border border-gray-300 bg-transparent"
    : activity.tone === "urgent"
      ? "bg-overdue"
      : "bg-mint";

  return (
    <li className="list-none">
      {showDividerAbove ? (
        <div
          aria-hidden="true"
          className="mb-3 border-b border-dashed border-gray-200"
        />
      ) : null}
      <div className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-b-0">
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`}
        />
        <div className="min-w-0 flex-1">
          <p
            className={
              !isRecent && activity.tone === "urgent"
                ? "text-sm font-medium text-foreground"
                : "text-sm text-foreground"
            }
          >
            {activity.message}
          </p>
          {isRecent ? (
            <p className="mt-1 text-xs text-label">{RECENT_ACTIVITY_FOOTNOTE}</p>
          ) : null}
        </div>
        <ArrowLink
          to={activity.to}
          className="shrink-0 whitespace-nowrap"
        >
          {activity.actionLabel}
        </ArrowLink>
      </div>
    </li>
  );
}

function buildQuickLinks(member: MemberResponse): QuickLink[] {
  const links: QuickLink[] = [];

  if (isRoleAtLeast(member.role, "board")) {
    links.push({
      title: "Past events",
      description: "Close-out status",
      to: "/events/past",
      icon: Archive,
    });
  }

  if (canViewMemberDirectory(member.role)) {
    links.push({
      title: "Member directory",
      description: "Browse NSA members",
      to: "/members",
      icon: Users,
    });
  }

  if (canViewTaskOversight(member.role, member.position)) {
    links.push({
      title: "Task oversight",
      description: "Team completion progress",
      to: "/events/oversight",
      icon: ClipboardList,
    });
  }

  if (canAccessFinance(member.role)) {
    links.push({
      title: "Finance",
      description: "Budgets and treasury",
      to: "/finance",
      icon: Wallet,
    });
  }

  if (member.role === "general") {
    links.push({
      title: "AI assistant",
      description: "Ask about NSA events",
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
  const [nextEvent, setNextEvent] = useState<EventResponse | null>(null);
  const [tasksSummary, setTasksSummary] = useState(summarizeMyTasks([]));
  const [activities, setActivities] = useState<HomeActivity[]>([]);
  const [nextBoardMeeting, setNextBoardMeeting] = useState<MeetingSummary | null>(
    null,
  );
  const [meetingAttendeeSummary, setMeetingAttendeeSummary] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [recentMemories, setRecentMemories] = useState<RecentMemoriesPreview | null>(
    null,
  );
  const [financePendingCount, setFinancePendingCount] = useState(0);
  const [financeEventOptions, setFinanceEventOptions] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [isLogTransactionOpen, setIsLogTransactionOpen] = useState(false);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);

  const isBoardMember = isRoleAtLeast(member.role, "board");
  const showFinanceQuickActions = canManageTreasury(member.role);
  const quickLinks = buildQuickLinks(member);
  const tasksPath = getMyTasksPath(member.role);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const upcomingPromise = fetchUpcomingEvents({ limit: 10 });
        const tasksPromise = fetchMyEventTasks().catch(() => ({
          tasks: [],
          total: 0,
        }));

        const pendingMembersPromise = isBoardMember
          ? fetchPendingMembers().catch(() => ({ members: [], total: 0 }))
          : Promise.resolve(null);

        const financePendingPromise = showFinanceQuickActions
          ? fetchPendingFinanceChangeRequests().catch(() => ({
              requests: [],
              total: 0,
            }))
          : Promise.resolve(null);

        const myFinanceRequestsPromise = showFinanceQuickActions
          ? fetchMyFinanceChangeRequestSummary().catch(() => ({
              pending_count: 0,
              recently_rejected_count: 0,
              recently_approved_count: 0,
            }))
          : Promise.resolve(null);

        const meetingsPromise = isBoardMember
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

        const nextMeeting = meetingsResult
          ? findNextBoardMeeting(meetingsResult.meetings)
          : null;

        let attendeeSummary: string | null = null;
        if (nextMeeting) {
          try {
            const attendees = await fetchEventAttendees(nextMeeting.event_id);
            attendeeSummary = formatCompactAttendeeSummary(attendees);
          } catch {
            attendeeSummary = null;
          }
        }

        if (cancelled) {
          return;
        }

        const summary = summarizeMyTasks(tasksResult.tasks);
        setNextEvent(findNextNonMeetingEvent(upcoming.events));
        setTasksSummary(summary);
        setActivities(
          buildHomeActivities({
            role: member.role,
            tasksSummary: summary,
            pendingMembersTotal: pendingMembers?.total ?? 0,
            financePendingTotal: financePending?.total ?? 0,
            myFinanceRequests,
          }),
        );
        setNextBoardMeeting(nextMeeting);
        setMeetingAttendeeSummary(attendeeSummary);
        setFinancePendingCount(financePending?.total ?? 0);
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
  }, [isBoardMember, member, showFinanceQuickActions, homeRefreshKey]);

  useEffect(() => {
    if (!showFinanceQuickActions) {
      return;
    }

    let cancelled = false;

    async function loadFinanceEventOptions() {
      try {
        const response = await fetchEvents();
        if (!cancelled) {
          setFinanceEventOptions(
            response.events
              .filter((event) => isEventFinanceEditable(event))
              .map((event) => ({
                id: event.id,
                name: event.name,
              })),
          );
        }
      } catch {
        if (!cancelled) {
          setFinanceEventOptions([]);
        }
      }
    }

    void loadFinanceEventOptions();

    return () => {
      cancelled = true;
    };
  }, [showFinanceQuickActions, homeRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentMemories() {
      try {
        const memories = await fetchRecentMemories();
        if (!cancelled) {
          setRecentMemories(memories);
        }
      } catch {
        if (!cancelled) {
          setRecentMemories(null);
        }
      }
    }

    void loadRecentMemories();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRsvpStatusChange(status: RsvpStatus) {
    if (!nextEvent) {
      return;
    }

    const snapshot = nextEvent;
    setRsvpLoading(true);
    setNextEvent((current) =>
      current ? { ...current, current_member_rsvp_status: status } : current,
    );

    try {
      const response = await updateEventRsvp(nextEvent.id, status);
      setNextEvent((current) =>
        current ? applyRsvpStatus(current, response) : current,
      );
    } catch {
      setNextEvent(snapshot);
    } finally {
      setRsvpLoading(false);
    }
  }

  const firstRecentActivityIndex = activities.findIndex(
    (activity) => activity.kind === "recent",
  );

  return (
    <div className="space-y-5">
      <CoverBanner />

      <div>
        <h1 className="text-2xl font-light tracking-headline text-foreground md:text-3xl">
          Welcome back,{" "}
          <span className="text-foreground">{member.full_name}</span>
        </h1>
        <p className="mt-1 text-sm text-label">
          Your daily check-in for NSA events and assigned work.
        </p>
      </div>

      {showFinanceQuickActions ? (
        <HomeFinanceQuickActions
          pendingApprovalCount={financePendingCount}
          onLogTransaction={() => setIsLogTransactionOpen(true)}
        />
      ) : null}

      {loadError ? (
        <div role="alert" className="ds-alert-banner">
          {loadError}
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section aria-label="Activity" className="ds-card self-start p-4">
          <h2 className="ds-section-label">Activity</h2>

          {isLoading ? (
            <p className="mt-4 text-sm text-label">Loading activity…</p>
          ) : null}

          {!isLoading && activities.length > 0 ? (
            <ul
              className={[
                "mt-3 overflow-y-auto overscroll-y-contain",
                HOME_ACTIVITY_MAX_HEIGHT_CLASS,
              ].join(" ")}
            >
              {activities.map((activity, index) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  showDividerAbove={
                    index === firstRecentActivityIndex &&
                    firstRecentActivityIndex > 0
                  }
                />
              ))}
            </ul>
          ) : null}

          {!isLoading && activities.length === 0 ? (
            <EmptyState
              icon="check"
              title="All caught up"
              description="Nothing needs your attention right now."
            />
          ) : null}
        </section>

        <HomeCard padding="sm" className="self-start">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-medium text-foreground">
              {member.role === "general" ? "Assigned work" : "Your work"}
            </h2>
            <ArrowLink to={tasksPath}>View all</ArrowLink>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-label">Loading tasks…</p>
          ) : null}

          {!isLoading && tasksSummary.openCount === 0 ? (
            <EmptyState
              icon="check"
              title="No open tasks assigned"
              description="You're all caught up."
            />
          ) : null}

          {!isLoading && tasksSummary.openCount > 0 ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="ds-stat-tile">
                  <SectionLabel icon={ListTodo}>Open</SectionLabel>
                  <p className="ds-stat-value">{tasksSummary.openCount}</p>
                </div>
                <div className="ds-stat-tile">
                  <SectionLabel
                    icon={AlertCircle}
                    iconClassName={
                      tasksSummary.overdueCount > 0
                        ? "h-4 w-4 shrink-0 text-overdue"
                        : "h-4 w-4 shrink-0 text-label"
                    }
                    className={
                      tasksSummary.overdueCount > 0 ? "text-overdue" : undefined
                    }
                  >
                    Overdue
                  </SectionLabel>
                  <p
                    className={
                      tasksSummary.overdueCount > 0
                        ? "ds-stat-overdue-chip"
                        : "ds-stat-value"
                    }
                  >
                    {tasksSummary.overdueCount}
                  </p>
                </div>
              </div>

              {tasksSummary.nextTask ? (
                <p className="text-sm text-foreground">
                  <span className="text-label">Next due: </span>
                  {getTaskDisplayName(tasksSummary.nextTask)}
                </p>
              ) : null}
            </div>
          ) : null}
        </HomeCard>
      </div>

      <div
        className={
          isBoardMember && nextBoardMeeting
            ? "grid items-start gap-5 lg:grid-cols-2"
            : "grid items-start gap-5"
        }
      >
        <HomeCard padding="sm" className="self-start">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-medium text-foreground">Up next</h2>
            <ArrowLink to="/events/calendar">Full calendar</ArrowLink>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-label">Loading events…</p>
          ) : null}

          {!isLoading && !nextEvent ? (
            <EmptyState
              icon="calendar"
              title="No upcoming events"
              description="Check the calendar for the next festival or social."
            />
          ) : null}

          {!isLoading && nextEvent ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    to={eventDetailPath(nextEvent.id)}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {nextEvent.name}
                  </Link>
                  <p className="mt-1 text-sm text-label">
                    {formatEventDateTime(nextEvent.starts_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[nextEvent.event_type]}`}
                >
                  {EVENT_TYPE_LABELS[nextEvent.event_type]}
                </span>
              </div>

              <EventRsvpButton
                currentStatus={nextEvent.current_member_rsvp_status}
                canRsvp
                loading={rsvpLoading}
                embedded
                onStatusChange={(status) => void handleRsvpStatusChange(status)}
              />
            </div>
          ) : null}
        </HomeCard>

        {isBoardMember && nextBoardMeeting ? (
          <HomeCard padding="sm" className="self-start">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-medium text-foreground">
                  Next board meeting
                </h2>
                <p className="mt-2 font-medium text-foreground">
                  {nextBoardMeeting.event_name}
                </p>
                <p className="mt-1 text-sm text-label">
                  {formatEventDateTime(nextBoardMeeting.starts_at)}
                </p>
                {meetingAttendeeSummary ? (
                  <p className="mt-3 text-sm text-label">
                    {meetingAttendeeSummary}
                  </p>
                ) : null}
              </div>
              <ArrowLink to={`/events/meetings/${nextBoardMeeting.event_id}`}>
                View
              </ArrowLink>
            </div>
          </HomeCard>
        ) : null}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <HomeProfileCard member={member} />

        {quickLinks.length > 0 ? (
          <HomeCard padding="sm" className="self-start">
            <h2 className="text-base font-medium text-foreground">
              More for your role
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <li key={link.to + link.title}>
                  <QuickLinkCard {...link} />
                </li>
              ))}
            </ul>
          </HomeCard>
        ) : null}
      </div>

      {recentMemories ? <RecentMemoriesStrip memories={recentMemories} /> : null}

      <Modal
        open={isLogTransactionOpen}
        title="Log transaction"
        onClose={() => setIsLogTransactionOpen(false)}
      >
        {isLogTransactionOpen ? (
          <LogFinanceEntryForm
            presentation="standalone"
            idPrefix="home-log-transaction"
            eventOptions={financeEventOptions}
            onCreated={() => {
              setIsLogTransactionOpen(false);
              setHomeRefreshKey((current) => current + 1);
            }}
          />
        ) : null}
      </Modal>
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
