import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CoverBanner } from "../components/CoverBanner";
import { HomeHeroBrand } from "../components/AppLogo";
import {
  buildWelcomeUrgency,
  HomeWelcomeBanner,
} from "../components/home/HomeMemberSections";
import { HomeActionCenter } from "../components/home/HomeActionCenter";
import { HomeFeaturedEvent } from "../components/home/HomeFeaturedEvent";
import { HomeMeetingMinutesCard } from "../components/home/HomeMeetingMinutesCard";
import {
  HomeTodayTimeline,
  getTodayTimelineItems,
} from "../components/home/HomeTodayTimeline";
import {
  buildHomeUrgencyChips,
  HomeUrgencyChips,
} from "../components/home/HomeUrgencyChips";
import { HomeWorkCenter } from "../components/home/HomeWorkCenter";
import { HomeDiscussionSection } from "../components/HomeDiscussionSection";
import { useAuth } from "../context/useAuth";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchMyEventTasks, updateEventTask } from "../lib/event-tasks-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import {
  fetchUpcomingEvents,
  type EventResponse,
} from "../lib/events-api";
import { fetchPendingFinanceChangeRequests } from "../lib/finance-api";
import {
  applyOptimisticTaskComplete,
  buildMarkTaskCompleteRequest,
  getMyTasksPath,
  summarizeMyTasks,
} from "../lib/home-tasks";
import { fetchPendingMembers } from "../lib/members-api";
import { findNextNonMeetingEvent } from "../lib/calendar-upcoming";
import {
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
  upcomingEvents: EventResponse[];
  tasksSummary: ReturnType<typeof summarizeMyTasks>;
  isLoading: boolean;
  loadError: string | null;
  financePendingCount: number;
  pendingMemberApprovals: number;
  showAssistant: boolean;
  showTaskOversight: boolean;
  tasksPath: string;
  completingTaskId: number | null;
  taskCompleteError: string | null;
  onCompleteTask: (taskId: number) => void;
};

const DASHBOARD_GAP = "gap-4";

function MemberHomeLayout({
  member,
  nextEvent,
  timelineEvents,
  upcomingEvents,
  tasksSummary,
  isLoading,
  loadError,
  financePendingCount,
  pendingMemberApprovals,
  showAssistant,
  showTaskOversight,
  tasksPath,
  completingTaskId,
  taskCompleteError,
  onCompleteTask,
}: MemberHomeLayoutProps) {
  const canReviewMembers = canViewMemberDirectory(member.role);
  const canReviewFinance = canManageTreasury(member.role, member.position);
  const urgencyChips = buildHomeUrgencyChips({
    tasksSummary,
    tasksPath,
    pendingMemberApprovals,
    financePendingCount,
    canReviewMembers,
    canReviewFinance,
  });
  const calmLine =
    urgencyChips.length === 0
      ? buildWelcomeUrgency({
          tasksSummary,
          pendingMemberApprovals,
          financePendingCount,
          nextEvent,
          member,
        })
      : undefined;
  const todayItems = getTodayTimelineItems(timelineEvents);
  const showTodayTimeline = !isLoading && todayItems.length > 0;

  return (
    <div className="home-dashboard mx-auto flex w-full max-w-[1120px] flex-col gap-5 pb-8">
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      <div className="space-y-2.5">
        <HomeWelcomeBanner member={member} calmLine={calmLine} />
        <HomeUrgencyChips chips={urgencyChips} />
      </div>

      <div
        className={[
          "grid grid-cols-1",
          DASHBOARD_GAP,
          "xl:grid-cols-12 xl:items-stretch",
        ].join(" ")}
      >
        <div className="min-w-0 xl:col-span-8 [&_>_*]:h-full">
          <HomeFeaturedEvent
            events={upcomingEvents}
            canManage={showAssistant}
            canCreateEvent={showAssistant}
            isLoading={isLoading}
          />
        </div>
        <div className="min-w-0 xl:col-span-4 [&_>_*]:h-full">
          <HomeActionCenter
            member={member}
            featuredEventId={nextEvent?.id ?? null}
            pendingMemberApprovals={pendingMemberApprovals}
            financePendingCount={financePendingCount}
            showAssistant={showAssistant}
          />
        </div>
      </div>

      <div
        className={[
          "grid grid-cols-1",
          DASHBOARD_GAP,
          showTodayTimeline
            ? "lg:grid-cols-2 xl:grid-cols-12 xl:items-stretch"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={[
            "min-h-0 [&_>_*]:h-full",
            showTodayTimeline ? "xl:col-span-7" : "xl:col-span-12",
          ].join(" ")}
        >
          <HomeWorkCenter
            member={member}
            showOversight={showTaskOversight}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            isLoading={isLoading}
            completingTaskId={completingTaskId}
            taskCompleteError={taskCompleteError}
            onCompleteTask={onCompleteTask}
          />
        </div>
        {showTodayTimeline ? (
          <div className="min-h-0 xl:col-span-5 [&_>_*]:h-full">
            <HomeTodayTimeline events={timelineEvents} />
          </div>
        ) : null}
      </div>

      {showAssistant ? (
        <div
          className={[
            "grid grid-cols-1",
            DASHBOARD_GAP,
            "xl:grid-cols-12 xl:items-stretch",
          ].join(" ")}
        >
          <div className="min-h-0 xl:col-span-7 [&_>_*]:h-full">
            <HomeDiscussionSection previewLimit={3} />
          </div>
          <div className="min-h-0 xl:col-span-5 [&_>_*]:h-full">
            <HomeMeetingMinutesCard />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const [upcomingEvents, setUpcomingEvents] = useState<EventResponse[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<EventResponse[]>([]);
  const [myTasks, setMyTasks] = useState<EventTaskResponse[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [taskCompleteError, setTaskCompleteError] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [financePendingCount, setFinancePendingCount] = useState(0);
  const [pendingMemberApprovals, setPendingMemberApprovals] = useState(0);

  const showFinancePending = canManageTreasury(member.role, member.position);
  const canReviewMembers = canViewMemberDirectory(member.role);
  const showAssistant = isRoleAtLeast(member.role, "board");
  const showTaskOversight = canViewTaskOversight(member.role, member.position);
  const tasksPath = getMyTasksPath(member.role);
  const tasksSummary = useMemo(() => summarizeMyTasks(myTasks), [myTasks]);
  const nextEvent = useMemo(
    () => findNextNonMeetingEvent(upcomingEvents),
    [upcomingEvents],
  );

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

        const [upcoming, tasksResult, financePending, pendingMembers] =
          await Promise.all([
            upcomingPromise,
            tasksPromise,
            financePendingPromise,
            pendingMembersPromise,
          ]);

        if (cancelled) {
          return;
        }

        const nonMeetingUpcoming = upcoming.events.filter(
          (event) => event.event_type !== "meeting",
        );
        setTimelineEvents(upcoming.events);
        setUpcomingEvents(nonMeetingUpcoming);
        setMyTasks(tasksResult.tasks);
        setFinancePendingCount(financePending?.total ?? 0);
        setPendingMemberApprovals(pendingMembers?.total ?? 0);
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
  }, [member, showFinancePending, canReviewMembers]);

  return (
    <MemberHomeLayout
      member={member}
      nextEvent={nextEvent}
      timelineEvents={timelineEvents}
      upcomingEvents={upcomingEvents}
      tasksSummary={tasksSummary}
      isLoading={isLoading}
      loadError={loadError}
      financePendingCount={financePendingCount}
      pendingMemberApprovals={pendingMemberApprovals}
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
