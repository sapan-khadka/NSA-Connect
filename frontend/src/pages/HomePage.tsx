import { useEffect, useState } from "react";
import {
  Archive,
  ClipboardList,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { CoverBanner } from "../components/CoverBanner";
import { HomeDiscussionSection } from "../components/HomeDiscussionSection";
import { HomeHeroBrand } from "../components/AppLogo";
import { HomeProfileCard } from "../components/HomeProfileCard";
import { LogFinanceEntryForm } from "../components/LogFinanceEntryForm";
import {
  HomeStatCards,
  HomeUpNextSection,
  HomeWelcomeBanner,
  HomeYourWorkSection,
  type QuickLink,
} from "../components/home/HomeMemberSections";
import { HomeCard } from "../components/ui/HomeCard";
import { IconBadge } from "../components/ui/IconBadge";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMyEventTasks } from "../lib/event-tasks-api";
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
import {
  fetchFinanceSummary,
  fetchPendingFinanceChangeRequests,
} from "../lib/finance-api";
import { getMyTasksPath, summarizeMyTasks } from "../lib/home-tasks";
import { fetchMembers } from "../lib/members-api";
import { fetchMeetings, type MeetingSummary } from "../lib/meetings-api";
import { fetchRecentMemories, type RecentMemoriesPreview } from "../lib/recent-memories";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
  canManageTreasury,
  canViewMemberDirectory,
  canViewTaskOversight,
  isRoleAtLeast,
} from "../lib/roles";

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

function buildRoleTools(member: MemberResponse): QuickLink[] {
  const links: QuickLink[] = [];

  if (isRoleAtLeast(member.role, "board")) {
    links.push({
      title: "Past Events",
      description: "Close-out status",
      to: "/events/past",
      icon: Archive,
      category: "events",
    });
  }

  if (canViewMemberDirectory(member.role)) {
    links.push({
      title: "Member Directory",
      description: "Browse NSA members",
      to: "/members",
      icon: Users,
      category: "members",
    });
  }

  if (canViewTaskOversight(member.role, member.position)) {
    links.push({
      title: "Task Oversight",
      description: "Team completion progress",
      to: "/events/oversight",
      icon: ClipboardList,
      category: "tasks",
    });
  }

  if (canAccessFinance(member.role)) {
    links.push({
      title: "Finance",
      description: "Budgets and treasury",
      to: "/finance",
      icon: Wallet,
      category: "finance",
    });
  }

  return links;
}

function PublicHomeView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-0">
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
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:bg-badge-teal-bg/40"
            >
              Create account
            </Link>
          </>
        }
      />
    </div>
  );
}

type MemberHomeLayoutProps = {
  member: MemberResponse;
  nextEvent: EventResponse | null;
  upcomingCount: number;
  tasksSummary: ReturnType<typeof summarizeMyTasks>;
  isLoading: boolean;
  loadError: string | null;
  rsvpLoading: boolean;
  financePendingCount: number;
  showFinanceQuickActions: boolean;
  memberCount: number | null;
  budgetBalance: string | null;
  canViewMembers: boolean;
  canViewFinance: boolean;
  quickLinks: QuickLink[];
  tasksPath: string;
  onRsvpStatusChange: (status: RsvpStatus) => void;
  onLogTransaction: () => void;
};

const DASHBOARD_GAP = "gap-4"; // 16px

function MemberHomeLayout({
  member,
  nextEvent,
  upcomingCount,
  tasksSummary,
  isLoading,
  loadError,
  rsvpLoading,
  financePendingCount,
  showFinanceQuickActions,
  memberCount,
  budgetBalance,
  canViewMembers,
  canViewFinance,
  quickLinks,
  tasksPath,
  onRsvpStatusChange,
  onLogTransaction,
}: MemberHomeLayoutProps) {
  return (
    <div className="home-dashboard mx-auto flex w-full max-w-[1280px] flex-col gap-4 xl:h-[calc(100dvh-7.5rem)] xl:overflow-hidden">
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      <div className="shrink-0">
        <HomeWelcomeBanner
          member={member}
          pendingApprovalCount={financePendingCount}
          nextEvent={nextEvent}
          openTaskCount={tasksSummary.openCount}
          budgetBalance={budgetBalance}
          showBudgetChip={canViewFinance}
          showLogTransaction={showFinanceQuickActions}
          onLogTransaction={onLogTransaction}
        />
      </div>

      <div className="shrink-0">
        <HomeStatCards
          tasksSummary={tasksSummary}
          upcomingCount={upcomingCount}
          nextEvent={nextEvent}
          memberCount={memberCount}
          budgetBalance={budgetBalance}
          tasksPath={tasksPath}
          canViewMembers={canViewMembers}
          canViewFinance={canViewFinance}
          isLoading={isLoading}
        />
      </div>

      {/* Middle — Discussion | Your Work | Upcoming Event */}
      <div
        className={[
          "grid min-h-0 grid-cols-1",
          DASHBOARD_GAP,
          "lg:grid-cols-3 xl:min-h-0 xl:flex-1 xl:overflow-hidden",
        ].join(" ")}
      >
        <div className="min-h-0 lg:h-full lg:min-h-0 [&_>_*]:h-full">
          <HomeDiscussionSection previewLimit={4} />
        </div>
        <div className="min-h-0 lg:h-full lg:min-h-0 [&_>_*]:h-full">
          <HomeYourWorkSection
            member={member}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            isLoading={isLoading}
          />
        </div>
        <div className="min-h-0 lg:h-full lg:min-h-0 [&_>_*]:h-full">
          <HomeUpNextSection
            nextEvent={nextEvent}
            isLoading={isLoading}
            rsvpLoading={rsvpLoading}
            onRsvpStatusChange={onRsvpStatusChange}
          />
        </div>
      </div>

      {/* Bottom — Profile ~40% | Tools ~60%, equal height */}
      <div
        className={[
          "grid shrink-0 grid-cols-1 items-stretch",
          DASHBOARD_GAP,
          "lg:grid-cols-5",
        ].join(" ")}
      >
        <div className="min-h-0 lg:col-span-2 [&_>_*]:h-full">
          <HomeProfileCard member={member} />
        </div>
        <div className="min-h-0 lg:col-span-3 [&_>_*]:h-full">
          <ToolsForRoleSection quickLinks={quickLinks} />
        </div>
      </div>
    </div>
  );
}

function ToolsForRoleSection({ quickLinks }: { quickLinks: QuickLink[] }) {
  if (quickLinks.length === 0) {
    return null;
  }

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="Tools for Your Role"
    >
      <h2 className="home-section-title shrink-0">Tools for Your Role</h2>
      <ul className="mt-3 grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
        {quickLinks.map((link) => {
          const className = [
            "group flex h-full min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-lg",
            "border border-gray-100 bg-surface-muted/50 px-2 py-2.5 text-center",
            "transition duration-150 hover:border-gray-200 hover:bg-surface-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          ].join(" ");

          const content = (
            <>
              <IconBadge icon={link.icon} tone="gray" size="xs" shape="rounded" />
              <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                {link.title}
              </span>
            </>
          );

          return (
            <li key={link.title} className="min-h-0">
              {link.onClick ? (
                <button
                  type="button"
                  onClick={link.onClick}
                  className={`w-full ${className}`}
                >
                  {content}
                </button>
              ) : link.to ? (
                <Link to={link.to} className={`block w-full ${className}`}>
                  {content}
                </Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </HomeCard>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const [nextEvent, setNextEvent] = useState<EventResponse | null>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [tasksSummary, setTasksSummary] = useState(summarizeMyTasks([]));
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
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [budgetBalance, setBudgetBalance] = useState<string | null>(null);
  const [financeEventOptions, setFinanceEventOptions] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [isLogTransactionOpen, setIsLogTransactionOpen] = useState(false);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);

  const isBoardMember = isRoleAtLeast(member.role, "board");
  const showFinanceQuickActions = canManageTreasury(
    member.role,
    member.position,
  );
  const canViewMembers = canBrowseMemberDirectory(member.role);
  const canViewFinance = canAccessFinance(member.role);
  const quickLinks = buildRoleTools(member);
  const tasksPath = getMyTasksPath(member.role);

  const layoutProps: MemberHomeLayoutProps = {
    member,
    nextEvent,
    upcomingCount,
    tasksSummary,
    isLoading,
    loadError,
    rsvpLoading,
    financePendingCount,
    showFinanceQuickActions,
    memberCount,
    budgetBalance,
    canViewMembers,
    canViewFinance,
    quickLinks,
    tasksPath,
    onRsvpStatusChange: (status) => void handleRsvpStatusChange(status),
    onLogTransaction: () => setIsLogTransactionOpen(true),
  };

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

        const financePendingPromise = showFinanceQuickActions
          ? fetchPendingFinanceChangeRequests().catch(() => ({
              requests: [],
              total: 0,
            }))
          : Promise.resolve(null);

        const meetingsPromise = isBoardMember
          ? fetchMeetings().catch(() => ({ meetings: [], total: 0 }))
          : Promise.resolve(null);

        const membersCountPromise = canViewMembers
          ? fetchMembers({ page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null);

        const financeSummaryPromise = canViewFinance
          ? fetchFinanceSummary().catch(() => null)
          : Promise.resolve(null);

        const [
          upcoming,
          tasksResult,
          financePending,
          meetingsResult,
          membersPage,
          financeSummary,
        ] = await Promise.all([
          upcomingPromise,
          tasksPromise,
          financePendingPromise,
          meetingsPromise,
          membersCountPromise,
          financeSummaryPromise,
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
        const nonMeetingUpcoming = upcoming.events.filter(
          (event) => event.event_type !== "meeting",
        );
        setNextEvent(findNextNonMeetingEvent(upcoming.events));
        setUpcomingCount(nonMeetingUpcoming.length);
        setTasksSummary(summary);
        setNextBoardMeeting(nextMeeting);
        setMeetingAttendeeSummary(attendeeSummary);
        setFinancePendingCount(financePending?.total ?? 0);
        setMemberCount(membersPage?.total ?? null);
        setBudgetBalance(financeSummary?.balance ?? null);
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
  }, [
    isBoardMember,
    member,
    showFinanceQuickActions,
    canViewMembers,
    canViewFinance,
    homeRefreshKey,
  ]);

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

  return (
    <>
      <MemberHomeLayout {...layoutProps} />

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
    </>
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
