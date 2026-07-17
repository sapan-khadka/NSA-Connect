import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CoverBanner } from "../components/CoverBanner";
import { HomeHeroBrand } from "../components/AppLogo";
import {
  HomeStatCards,
  HomeUpNextSection,
  HomeWelcomeBanner,
  HomeYourWorkSection,
} from "../components/home/HomeMemberSections";
import {
  HomeBoardFeed,
  HomeCampusAiCard,
} from "../components/home/HomeWorkspacePanels";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchMyEventTasks, updateEventTask } from "../lib/event-tasks-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import { applyRsvpStatus } from "../lib/event-rsvp";
import {
  fetchUpcomingEvents,
  updateEventRsvp,
  type EventResponse,
  type RsvpStatus,
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
  upcomingCount: number;
  tasksSummary: ReturnType<typeof summarizeMyTasks>;
  isLoading: boolean;
  loadError: string | null;
  rsvpLoading: boolean;
  financePendingCount: number;
  pendingMemberApprovals: number;
  memberCount: number | null;
  budgetBalance: string | null;
  canViewMembers: boolean;
  canViewFinance: boolean;
  tasksPath: string;
  completingTaskId: number | null;
  taskCompleteError: string | null;
  onCompleteTask: (taskId: number) => void;
  onRsvpStatusChange: (status: RsvpStatus) => void;
};

const DASHBOARD_GAP = "gap-4";

function MemberHomeLayout({
  member,
  nextEvent,
  upcomingCount,
  tasksSummary,
  isLoading,
  loadError,
  rsvpLoading,
  financePendingCount,
  pendingMemberApprovals,
  memberCount,
  budgetBalance,
  canViewMembers,
  canViewFinance,
  tasksPath,
  completingTaskId,
  taskCompleteError,
  onCompleteTask,
  onRsvpStatusChange,
}: MemberHomeLayoutProps) {
  return (
    <div className="home-dashboard mx-auto flex w-full max-w-[1280px] flex-col gap-4 pb-6 xl:min-h-0">
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      {/* Row 1 — Hero (12) */}
      <div className="shrink-0">
        <HomeWelcomeBanner
          member={member}
          pendingApprovalCount={financePendingCount}
          nextEvent={nextEvent}
          openTaskCount={tasksSummary.openCount}
          budgetBalance={budgetBalance}
          showBudgetChip={canViewFinance}
        />
      </div>

      {/* Row 2 — KPIs (12) */}
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

      {/* Row 3 — Board Feed (6) + Upcoming Event (6) */}
      <div
        className={[
          "grid grid-cols-1",
          DASHBOARD_GAP,
          "md:grid-cols-6 lg:grid-cols-12 lg:items-stretch",
        ].join(" ")}
      >
        <div className="min-h-[18rem] md:col-span-6 lg:col-span-6 [&_>_*]:h-full">
          <HomeBoardFeed previewLimit={3} />
        </div>
        <div className="min-h-[18rem] md:col-span-6 lg:col-span-6 [&_>_*]:h-full">
          <HomeUpNextSection
            nextEvent={nextEvent}
            isLoading={isLoading}
            rsvpLoading={rsvpLoading}
            onRsvpStatusChange={onRsvpStatusChange}
          />
        </div>
      </div>

      {/* Row 4 — My Tasks (6) + CampusOS AI (6) */}
      <div
        className={[
          "grid grid-cols-1",
          DASHBOARD_GAP,
          "md:grid-cols-6 lg:grid-cols-12 lg:items-stretch",
        ].join(" ")}
      >
        <div className="min-h-[16rem] md:col-span-6 lg:col-span-6 [&_>_*]:h-full">
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
        </div>
        <div className="min-h-[16rem] md:col-span-6 lg:col-span-6 [&_>_*]:h-full">
          <HomeCampusAiCard />
        </div>
      </div>
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const [nextEvent, setNextEvent] = useState<EventResponse | null>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [myTasks, setMyTasks] = useState<EventTaskResponse[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [taskCompleteError, setTaskCompleteError] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [financePendingCount, setFinancePendingCount] = useState(0);
  const [pendingMemberApprovals, setPendingMemberApprovals] = useState(0);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [budgetBalance, setBudgetBalance] = useState<string | null>(null);

  const showFinancePending = canManageTreasury(member.role, member.position);
  const canReviewMembers = canViewMemberDirectory(member.role);
  const canViewMembers = canBrowseMemberDirectory(member.role);
  const canViewFinance = canAccessFinance(member.role);
  const tasksPath = getMyTasksPath(member.role);
  const tasksSummary = useMemo(() => summarizeMyTasks(myTasks), [myTasks]);

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
        setNextEvent(findNextNonMeetingEvent(upcoming.events));
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
    <MemberHomeLayout
      member={member}
      nextEvent={nextEvent}
      upcomingCount={upcomingCount}
      tasksSummary={tasksSummary}
      isLoading={isLoading}
      loadError={loadError}
      rsvpLoading={rsvpLoading}
      financePendingCount={financePendingCount}
      pendingMemberApprovals={pendingMemberApprovals}
      memberCount={memberCount}
      budgetBalance={budgetBalance}
      canViewMembers={canViewMembers}
      canViewFinance={canViewFinance}
      tasksPath={tasksPath}
      completingTaskId={completingTaskId}
      taskCompleteError={taskCompleteError}
      onCompleteTask={(taskId) => {
        void handleCompleteTask(taskId);
      }}
      onRsvpStatusChange={handleRsvpStatusChange}
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
