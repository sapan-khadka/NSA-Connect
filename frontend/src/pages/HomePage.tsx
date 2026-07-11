import { useEffect, useState, type ReactNode } from "react";
import {
  Archive,
  ClipboardList,
  Users,
  Wallet,
  Wrench,
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
  QuickLinkCard,
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

const DASHBOARD_GAP = "gap-6"; // 24px
const DASHBOARD_SECTION_SPACE = "space-y-6"; // ~24px row rhythm like reference
const DASHBOARD_GRID =
  "grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 items-stretch";

function dashboardSpan(
  span: "full" | "half" | "third" | "profile" | "tools",
): string {
  switch (span) {
    case "full":
      return "col-span-1 md:col-span-6 xl:col-span-12";
    case "half":
      return "col-span-1 md:col-span-6 xl:col-span-6";
    case "third":
      return "col-span-1 md:col-span-6 xl:col-span-4";
    case "profile":
      return "col-span-1 md:col-span-6 xl:col-span-5";
    case "tools":
      return "col-span-1 md:col-span-6 xl:col-span-7";
  }
}

function DashboardCell({
  span,
  children,
}: {
  span: "full" | "half" | "third" | "profile" | "tools";
  children: ReactNode;
}) {
  return (
    <div className={`${dashboardSpan(span)} flex min-h-0 flex-col`}>
      <div className="flex h-full min-h-0 flex-col [&_>_*]:h-full [&_>_*]:min-h-0">
        {children}
      </div>
    </div>
  );
}

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
    <div className={`mx-auto w-full max-w-[1480px] ${DASHBOARD_SECTION_SPACE}`}>
      {loadError ? (
        <div role="alert" className="ds-alert-banner">
          {loadError}
        </div>
      ) : null}

      {/* Row 1 — Hero (12) */}
      <div className={`${DASHBOARD_GRID} ${DASHBOARD_GAP}`}>
        <DashboardCell span="full">
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
        </DashboardCell>
      </div>

      {/* Row 2 — KPIs 3|3|3|3 */}
      <div className={`${DASHBOARD_GRID} ${DASHBOARD_GAP}`}>
        <DashboardCell span="full">
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
        </DashboardCell>
      </div>

      {/* Row 3 — Discussion | Your Work (6|6) */}
      <div className={`${DASHBOARD_GRID} ${DASHBOARD_GAP}`}>
        <DashboardCell span="half">
          <HomeDiscussionSection previewLimit={3} />
        </DashboardCell>
        <DashboardCell span="half">
          <HomeYourWorkSection
            member={member}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            isLoading={isLoading}
          />
        </DashboardCell>
      </div>

      {/* Row 4 — Upcoming Event (12) */}
      <div className={`${DASHBOARD_GRID} ${DASHBOARD_GAP}`}>
        <DashboardCell span="full">
          <HomeUpNextSection
            nextEvent={nextEvent}
            isLoading={isLoading}
            rsvpLoading={rsvpLoading}
            onRsvpStatusChange={onRsvpStatusChange}
          />
        </DashboardCell>
      </div>

      {/* Row 5 — Profile (5) | Tools (7) */}
      <div className={`${DASHBOARD_GRID} ${DASHBOARD_GAP}`}>
        <DashboardCell span="profile">
          <HomeProfileCard member={member} />
        </DashboardCell>
        <DashboardCell span="tools">
          <ToolsForRoleSection quickLinks={quickLinks} />
        </DashboardCell>
      </div>
    </div>
  );
}

function ToolsForRoleSection({ quickLinks }: { quickLinks: QuickLink[] }) {
  if (quickLinks.length === 0) {
    return null;
  }

  return (
    <HomeCard className="flex h-full flex-col">
      <div className="ds-icon-label">
        <IconBadge icon={Wrench} category="tools" size="sm" />
        <h2 className="text-lg font-semibold text-foreground">
          Tools for Your Role
        </h2>
      </div>
      <ul
        className={[
          "mt-5 grid flex-1 gap-4",
          quickLinks.length >= 4
            ? "grid-cols-2 xl:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3",
        ].join(" ")}
      >
        {quickLinks.map((link) => (
          <li key={link.title} className="min-h-0">
            <QuickLinkCard {...link} />
          </li>
        ))}
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
