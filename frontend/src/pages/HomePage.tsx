import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CoverBanner } from "../components/CoverBanner";
import { HomeHeroBrand } from "../components/AppLogo";
import {
  HomeStatCards,
  HomeWelcomeBanner,
  HomeYourWorkSection,
} from "../components/home/HomeMemberSections";
import { HomeCampusAiCard } from "../components/home/HomeWorkspacePanels";
import { HomeFeaturedEvent } from "../components/home/HomeFeaturedEvent";
import { HomeOrgHealth } from "../components/home/HomeOrgHealth";
import { HomeQuickActions } from "../components/home/HomeQuickActions";
import { HomeTaskOversightSection } from "../components/home/HomeTaskOversightSection";
import { HomeTodayTimeline } from "../components/home/HomeTodayTimeline";
import { HomeUpcomingDeadlines } from "../components/home/HomeUpcomingDeadlines";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchMyEventTasks, updateEventTask } from "../lib/event-tasks-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import {
  fetchUpcomingEvents,
  type EventResponse,
} from "../lib/events-api";
import {
  fetchFinanceSummary,
  fetchPendingFinanceChangeRequests,
} from "../lib/finance-api";
import {
  applyOptimisticTaskComplete,
  buildMarkTaskCompleteRequest,
  getMyTasksPath,
  summarizeMyTasks,
} from "../lib/home-tasks";
import { fetchMembers, fetchPendingMembers } from "../lib/members-api";
import { findNextNonMeetingEvent } from "../lib/calendar-upcoming";
import {
  canAccessFinance,
  canBrowseMemberDirectory,
  canManageTreasury,
  canViewMemberDirectory,
  canViewTaskOversight,
  isRoleAtLeast,
} from "../lib/roles";

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
  timelineEvents: EventResponse[];
  deadlineEvents: EventResponse[];
  upcomingCount: number;
  openTaskCountByEventId: Record<number, number>;
  tasksSummary: ReturnType<typeof summarizeMyTasks>;
  isLoading: boolean;
  loadError: string | null;
  financePendingCount: number;
  pendingMemberApprovals: number;
  memberCount: number | null;
  budgetBalance: string | null;
  canViewMembers: boolean;
  canViewFinance: boolean;
  showAssistant: boolean;
  showTaskOversight: boolean;
  tasksPath: string;
  completingTaskId: number | null;
  taskCompleteError: string | null;
  onCompleteTask: (taskId: number) => void;
};

const DASHBOARD_GAP = "gap-3";

function MemberHomeLayout({
  member,
  nextEvent,
  timelineEvents,
  deadlineEvents,
  upcomingCount,
  openTaskCountByEventId,
  tasksSummary,
  isLoading,
  loadError,
  financePendingCount,
  pendingMemberApprovals,
  memberCount,
  budgetBalance,
  canViewMembers,
  canViewFinance,
  showAssistant,
  showTaskOversight,
  tasksPath,
  completingTaskId,
  taskCompleteError,
  onCompleteTask,
}: MemberHomeLayoutProps) {
  return (
    <div className="home-dashboard mx-auto flex w-full max-w-[1280px] flex-col gap-3 pb-4">
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      <HomeWelcomeBanner member={member} />

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

      {/* Featured + AI */}
      <div
        className={[
          "grid grid-cols-1",
          DASHBOARD_GAP,
          "xl:grid-cols-12 xl:items-stretch",
        ].join(" ")}
      >
        <div className="min-w-0 xl:col-span-8 [&_>_*]:h-full">
          <HomeFeaturedEvent
            events={deadlineEvents}
            openTaskCountByEventId={openTaskCountByEventId}
            canManage={showAssistant}
            isLoading={isLoading}
          />
        </div>
        <div className="min-w-0 xl:col-span-4 [&_>_*]:h-full">
          {showAssistant ? (
            <HomeCampusAiCard compact />
          ) : (
            <HomeQuickActions
              member={member}
              featuredEventId={nextEvent?.id ?? null}
            />
          )}
        </div>
      </div>

      {/* Tasks | Timeline | Quick Actions + Deadlines */}
      <div
        className={[
          "grid grid-cols-1",
          DASHBOARD_GAP,
          "lg:grid-cols-2 xl:grid-cols-12 xl:items-stretch",
        ].join(" ")}
      >
        <div className="min-h-0 xl:col-span-4 [&_>_*]:h-full">
          {showTaskOversight ? (
            <HomeTaskOversightSection />
          ) : (
            <HomeYourWorkSection
              member={member}
              tasksSummary={tasksSummary}
              tasksPath={tasksPath}
              isLoading={isLoading}
              completingTaskId={completingTaskId}
              taskCompleteError={taskCompleteError}
              onCompleteTask={onCompleteTask}
              pendingMemberApprovals={pendingMemberApprovals}
              financePendingCount={financePendingCount}
            />
          )}
        </div>
        <div className="min-h-0 xl:col-span-4 [&_>_*]:h-full">
          <HomeTodayTimeline events={timelineEvents} isLoading={isLoading} />
        </div>
        <div
          className={[
            "flex min-w-0 flex-col",
            DASHBOARD_GAP,
            "xl:col-span-4",
          ].join(" ")}
        >
          {showAssistant ? (
            <HomeQuickActions
              member={member}
              featuredEventId={nextEvent?.id ?? null}
            />
          ) : null}
          <HomeUpcomingDeadlines
            events={deadlineEvents}
            isLoading={isLoading}
          />
        </div>
      </div>

      <HomeOrgHealth
        memberCount={memberCount}
        openTaskCount={tasksSummary.openCount}
        overdueCount={tasksSummary.overdueCount}
        upcomingCount={upcomingCount}
        budgetBalance={budgetBalance}
        canViewFinance={canViewFinance}
      />
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const [upcomingEvents, setUpcomingEvents] = useState<EventResponse[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<EventResponse[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [myTasks, setMyTasks] = useState<EventTaskResponse[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [taskCompleteError, setTaskCompleteError] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [financePendingCount, setFinancePendingCount] = useState(0);
  const [pendingMemberApprovals, setPendingMemberApprovals] = useState(0);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [budgetBalance, setBudgetBalance] = useState<string | null>(null);

  const showFinancePending = canManageTreasury(member.role, member.position);
  const canReviewMembers = canViewMemberDirectory(member.role);
  const canViewMembers = canBrowseMemberDirectory(member.role);
  const canViewFinance = canAccessFinance(member.role);
  const showAssistant = isRoleAtLeast(member.role, "board");
  const showTaskOversight = canViewTaskOversight(member.role, member.position);
  const tasksPath = getMyTasksPath(member.role);
  const tasksSummary = useMemo(() => summarizeMyTasks(myTasks), [myTasks]);
  const nextEvent = useMemo(
    () => findNextNonMeetingEvent(upcomingEvents),
    [upcomingEvents],
  );
  const openTaskCountByEventId = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const task of myTasks) {
      if (task.is_complete) {
        continue;
      }
      counts[task.event_id] = (counts[task.event_id] ?? 0) + 1;
    }
    return counts;
  }, [myTasks]);

  async function handleCompleteTask(taskId: number) {
    const target = myTasks.find((task) => task.id === taskId);
    if (!target || target.is_complete) {
      return;
    }

    const snapshot = myTasks;
    setTaskCompleteError(null);
    setCompletingTaskId(taskId);
    setMyTasks((current) =>
      current.map((task) =>
        task.id === taskId ? applyOptimisticTaskComplete(task) : task,
      ),
    );

    try {
      const updated = await updateEventTask(
        taskId,
        buildMarkTaskCompleteRequest(target),
      );
      setMyTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
    } catch (error) {
      setMyTasks(snapshot);
      setTaskCompleteError(getApiErrorMessage(error));
    } finally {
      setCompletingTaskId(null);
    }
  }

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

        const financePendingPromise = showFinancePending
          ? fetchPendingFinanceChangeRequests().catch(() => ({
              requests: [],
              total: 0,
            }))
          : Promise.resolve(null);

        const pendingMembersPromise = canReviewMembers
          ? fetchPendingMembers().catch(() => ({ members: [], total: 0 }))
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
          pendingMembers,
          membersPage,
          financeSummary,
        ] = await Promise.all([
          upcomingPromise,
          tasksPromise,
          financePendingPromise,
          pendingMembersPromise,
          membersCountPromise,
          financeSummaryPromise,
        ]);

        if (cancelled) {
          return;
        }

        const nonMeetingUpcoming = upcoming.events.filter(
          (event) => event.event_type !== "meeting",
        );
        setTimelineEvents(upcoming.events);
        setUpcomingEvents(nonMeetingUpcoming);
        setUpcomingCount(nonMeetingUpcoming.length);
        setMyTasks(tasksResult.tasks);
        setFinancePendingCount(financePending?.total ?? 0);
        setPendingMemberApprovals(pendingMembers?.total ?? 0);
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
    member,
    showFinancePending,
    canReviewMembers,
    canViewMembers,
    canViewFinance,
  ]);

  return (
    <MemberHomeLayout
      member={member}
      nextEvent={nextEvent}
      timelineEvents={timelineEvents}
      deadlineEvents={upcomingEvents}
      upcomingCount={upcomingCount}
      openTaskCountByEventId={openTaskCountByEventId}
      tasksSummary={tasksSummary}
      isLoading={isLoading}
      loadError={loadError}
      financePendingCount={financePendingCount}
      pendingMemberApprovals={pendingMemberApprovals}
      memberCount={memberCount}
      budgetBalance={budgetBalance}
      canViewMembers={canViewMembers}
      canViewFinance={canViewFinance}
      showAssistant={showAssistant}
      showTaskOversight={showTaskOversight}
      tasksPath={tasksPath}
      completingTaskId={completingTaskId}
      taskCompleteError={taskCompleteError}
      onCompleteTask={(taskId) => {
        void handleCompleteTask(taskId);
      }}
    />
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
