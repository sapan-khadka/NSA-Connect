import { useEffect, useState, type ReactNode } from "react";
import {
  Archive,
  ClipboardList,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";

import { CoverBanner } from "../components/CoverBanner";
import { HomeAnnouncementsSection } from "../components/HomeAnnouncementsSection";
import { HomeFinanceQuickActions } from "../components/HomeFinanceQuickActions";
import { HomeHeroBrand } from "../components/AppLogo";
import { HomeProfileCard } from "../components/HomeProfileCard";
import { LogFinanceEntryForm } from "../components/LogFinanceEntryForm";
import { RecentMemoriesStrip } from "../components/RecentMemoriesStrip";
import {
  HomeActivitySection,
  HomeBoardMeetingSection,
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
import { Card } from "../design-system/components/Card";
import { Divider } from "../design-system/components/Divider";
import { useAuth } from "../context/useAuth";
import { useIsLgUp } from "../hooks/useMediaQuery";
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
  fetchMyFinanceChangeRequestSummary,
} from "../lib/finance-api";
import { getMobileActivityPreview } from "../lib/home-activity-preview";
import {
  buildHomeActivities,
  type HomeActivity,
} from "../lib/home-activities";
import { getMyTasksPath, summarizeMyTasks } from "../lib/home-tasks";
import { fetchMembers, fetchPendingMembers } from "../lib/members-api";
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
import { AppIcon } from "../components/ui/AppIcon";

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

function buildQuickLinks(member: MemberResponse): QuickLink[] {
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

  if (member.role === "general") {
    links.push({
      title: "AI assistant",
      description: "Ask about NSA events",
      to: "/assistant",
      icon: Sparkles,
      category: "assistant",
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
  activities: HomeActivity[];
  mobileActivityPreview: HomeActivity[];
  nextEvent: EventResponse | null;
  upcomingCount: number;
  tasksSummary: ReturnType<typeof summarizeMyTasks>;
  nextBoardMeeting: MeetingSummary | null;
  meetingAttendeeSummary: string | null;
  isLoading: boolean;
  loadError: string | null;
  rsvpLoading: boolean;
  recentMemories: RecentMemoriesPreview | null;
  financePendingCount: number;
  showFinanceQuickActions: boolean;
  memberCount: number | null;
  budgetBalance: string | null;
  canViewMembers: boolean;
  canViewFinance: boolean;
  quickLinks: QuickLink[];
  tasksPath: string;
  isBoardMember: boolean;
  onRsvpStatusChange: (status: RsvpStatus) => void;
  onLogTransaction: () => void;
};

function DashboardSection({
  label,
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["space-y-3", className].filter(Boolean).join(" ")}>
      {label ? (
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-label">
          {label}
        </h2>
      ) : null}
      {children}
    </section>
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
        <h2 className="text-lg font-semibold text-foreground">Quick Tools</h2>
      </div>
      <ul className="mt-4 grid flex-1 grid-cols-2 gap-4">
        {quickLinks.map((link) => (
          <li key={link.to + link.title} className="min-h-0">
            <QuickLinkCard {...link} />
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}

/** Layout shell for the assistant entry — reuses design-system Card, not a new feature. */
function HomeAssistantPanel() {
  return (
    <Card
      as="div"
      padding="md"
      interactive
      className="flex h-full flex-col justify-between"
    >
      <div className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-badge-teal-bg text-primary">
          <AppIcon icon={Sparkles} size="md" className="text-current" />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-headline text-foreground">
            AI Assistant
          </h2>
          <p className="text-sm leading-relaxed text-label">
            Ask about events, dues, members, and how to get things done in NSA
            Connect.
          </p>
        </div>
      </div>
      <Link
        to="/assistant"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
      >
        Open assistant
      </Link>
    </Card>
  );
}

function DesktopMemberHomeLayout({
  member,
  activities,
  nextEvent,
  upcomingCount,
  tasksSummary,
  nextBoardMeeting,
  meetingAttendeeSummary,
  isLoading,
  loadError,
  rsvpLoading,
  recentMemories,
  financePendingCount,
  showFinanceQuickActions,
  memberCount,
  budgetBalance,
  canViewMembers,
  canViewFinance,
  quickLinks,
  tasksPath,
  isBoardMember,
  onRsvpStatusChange,
  onLogTransaction,
}: MemberHomeLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8">
      {/* 1. Hero */}
      <DashboardSection>
        <HomeWelcomeBanner
          member={member}
          pendingApprovalCount={financePendingCount}
          nextEvent={nextEvent}
          openTaskCount={tasksSummary.openCount}
          budgetBalance={budgetBalance}
          showBudgetChip={canViewFinance}
        />
        {loadError ? (
          <div role="alert" className="ds-alert-banner">
            {loadError}
          </div>
        ) : null}
      </DashboardSection>

      {/* 2. KPI cards */}
      <DashboardSection label="Overview">
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
      </DashboardSection>

      {/* 3. Announcements + Activity */}
      <DashboardSection label="Updates">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <HomeAnnouncementsSection previewLimit={2} />
          <HomeActivitySection
            activities={activities}
            isLoading={isLoading}
            tasksPath={tasksPath}
            scrollable
          />
        </div>
      </DashboardSection>

      {/* 4. Upcoming event (full width) */}
      <DashboardSection label="Upcoming">
        <div className="space-y-6">
          <HomeUpNextSection
            nextEvent={nextEvent}
            isLoading={isLoading}
            rsvpLoading={rsvpLoading}
            onRsvpStatusChange={onRsvpStatusChange}
          />
          {isBoardMember && nextBoardMeeting ? (
            <HomeBoardMeetingSection
              meeting={nextBoardMeeting}
              attendeeSummary={meetingAttendeeSummary}
            />
          ) : null}
          <HomeYourWorkSection
            member={member}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      <Divider />

      {/* 5. Quick Actions + AI Assistant */}
      <DashboardSection label="Actions">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-6">
            {showFinanceQuickActions ? (
              <HomeFinanceQuickActions
                pendingApprovalCount={financePendingCount}
                onLogTransaction={onLogTransaction}
              />
            ) : null}
            <ToolsForRoleSection quickLinks={quickLinks} />
          </div>
          <HomeAssistantPanel />
        </div>
      </DashboardSection>

      {/* 6. Profile */}
      <DashboardSection label="Account">
        <div className="max-w-xl">
          <HomeProfileCard member={member} />
        </div>
      </DashboardSection>

      {recentMemories ? (
        <>
          <Divider />
          <DashboardSection>
            <RecentMemoriesStrip memories={recentMemories} />
          </DashboardSection>
        </>
      ) : null}
    </div>
  );
}

function MobileMemberHomeLayout({
  member,
  activities,
  mobileActivityPreview,
  nextEvent,
  upcomingCount,
  tasksSummary,
  nextBoardMeeting,
  meetingAttendeeSummary,
  isLoading,
  loadError,
  rsvpLoading,
  recentMemories,
  financePendingCount,
  showFinanceQuickActions,
  memberCount,
  budgetBalance,
  canViewMembers,
  canViewFinance,
  quickLinks,
  tasksPath,
  isBoardMember,
  onRsvpStatusChange,
  onLogTransaction,
}: MemberHomeLayoutProps) {
  return (
    <div className="space-y-8">
      {/* 1. Hero */}
      <DashboardSection>
        <HomeWelcomeBanner
          member={member}
          pendingApprovalCount={financePendingCount}
          nextEvent={nextEvent}
          openTaskCount={tasksSummary.openCount}
          budgetBalance={budgetBalance}
          showBudgetChip={canViewFinance}
        />
        {loadError ? (
          <div role="alert" className="ds-alert-banner">
            {loadError}
          </div>
        ) : null}
      </DashboardSection>

      {/* 2. KPI cards */}
      <DashboardSection label="Overview">
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
      </DashboardSection>

      {/* 3. Announcements + Activity */}
      <DashboardSection label="Updates">
        <div className="space-y-6">
          <HomeAnnouncementsSection previewLimit={2} />
          <HomeActivitySection
            activities={mobileActivityPreview}
            isLoading={isLoading}
            tasksPath={tasksPath}
            truncatedFromTotal={activities.length}
            scrollable={false}
          />
        </div>
      </DashboardSection>

      {/* 4. Upcoming event */}
      <DashboardSection label="Upcoming">
        <div className="space-y-6">
          <HomeUpNextSection
            nextEvent={nextEvent}
            isLoading={isLoading}
            rsvpLoading={rsvpLoading}
            onRsvpStatusChange={onRsvpStatusChange}
          />
          {isBoardMember && nextBoardMeeting ? (
            <HomeBoardMeetingSection
              meeting={nextBoardMeeting}
              attendeeSummary={meetingAttendeeSummary}
            />
          ) : null}
          <HomeYourWorkSection
            member={member}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            isLoading={isLoading}
          />
        </div>
      </DashboardSection>

      {/* 5. Quick Actions + AI Assistant */}
      <DashboardSection label="Actions">
        <div className="space-y-6">
          {showFinanceQuickActions ? (
            <HomeFinanceQuickActions
              pendingApprovalCount={financePendingCount}
              onLogTransaction={onLogTransaction}
            />
          ) : null}
          <ToolsForRoleSection quickLinks={quickLinks} />
          <HomeAssistantPanel />
        </div>
      </DashboardSection>

      {/* 6. Profile */}
      <DashboardSection label="Account">
        <HomeProfileCard member={member} />
      </DashboardSection>

      {recentMemories ? (
        <DashboardSection>
          <RecentMemoriesStrip memories={recentMemories} />
        </DashboardSection>
      ) : null}
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const [nextEvent, setNextEvent] = useState<EventResponse | null>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
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
  const quickLinks = buildQuickLinks(member);
  const tasksPath = getMyTasksPath(member.role);
  const isLgUp = useIsLgUp();
  const mobileActivityPreview = getMobileActivityPreview(activities, 2);

  const layoutProps: MemberHomeLayoutProps = {
    member,
    activities,
    mobileActivityPreview,
    nextEvent,
    upcomingCount,
    tasksSummary,
    nextBoardMeeting,
    meetingAttendeeSummary,
    isLoading,
    loadError,
    rsvpLoading,
    recentMemories,
    financePendingCount,
    showFinanceQuickActions,
    memberCount,
    budgetBalance,
    canViewMembers,
    canViewFinance,
    quickLinks,
    tasksPath,
    isBoardMember,
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

        const membersCountPromise = canViewMembers
          ? fetchMembers({ page: 1, page_size: 1 }).catch(() => null)
          : Promise.resolve(null);

        const financeSummaryPromise = canViewFinance
          ? fetchFinanceSummary().catch(() => null)
          : Promise.resolve(null);

        const [
          upcoming,
          tasksResult,
          pendingMembers,
          financePending,
          myFinanceRequests,
          meetingsResult,
          membersPage,
          financeSummary,
        ] = await Promise.all([
          upcomingPromise,
          tasksPromise,
          pendingMembersPromise,
          financePendingPromise,
          myFinanceRequestsPromise,
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
      {isLgUp ? (
        <DesktopMemberHomeLayout {...layoutProps} />
      ) : (
        <MobileMemberHomeLayout {...layoutProps} />
      )}

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
