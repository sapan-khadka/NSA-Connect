import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

function homeStage(stage: number): CSSProperties {
  return { ["--home-stage" as string]: stage };
}

import { CoverBanner } from "../components/CoverBanner";
import { HomeHeroBrand } from "../components/AppLogo";
import {
  buildWelcomeUrgency,
  HomeWelcomeBanner,
} from "../components/home/HomeMemberSections";
import { HomeFeaturedEvent } from "../components/home/HomeFeaturedEvent";
import { HomeQuickActions } from "../components/home/HomeQuickActions";
import { HomeQuickStats } from "../components/home/HomeQuickStats";
import { HomeRecentActivity } from "../components/home/HomeRecentActivity";
import { HomeWorkCenter } from "../components/home/HomeWorkCenter";
import { HomeDiscussionSection } from "../components/HomeDiscussionSection";
import { useAuth } from "../context/useAuth";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchMyEventTasks, updateEventTask } from "../lib/event-tasks-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import {
  fetchUpcomingEvents,
  type EventResponse,
} from "../lib/events-api";
import {
  applyOptimisticTaskComplete,
  buildMarkTaskCompleteRequest,
  getMyTasksPath,
  summarizeMyTasks,
} from "../lib/home-tasks";
import { findNextNonMeetingEvent } from "../lib/calendar-upcoming";
import {
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
  featuredEvents: EventResponse[];
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

function MemberHomeLayout({
  member,
  nextEvent,
  featuredEvents,
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
  const calmLine = buildWelcomeUrgency({
    tasksSummary,
    pendingMemberApprovals,
    financePendingCount,
    nextEvent,
    member,
  });

  return (
    <div className="home-dashboard home-dashboard--v3 flex w-full min-w-0 flex-col gap-4 pb-8">
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      <div className="home-enter" style={homeStage(0)}>
        <HomeFeaturedEvent
          events={featuredEvents}
          canManage={showAssistant}
          canCreateEvent={showAssistant}
          isLoading={isLoading}
        />
      </div>

      <div className="home-enter space-y-3" style={homeStage(1)}>
        <HomeWelcomeBanner member={member} calmLine={calmLine} />
        <HomeQuickActions member={member} />
      </div>

      <div
        className={[
          "home-enter home-split",
          showAssistant ? "home-split--with-discussions" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={homeStage(2)}
      >
        {showAssistant ? (
          <div className="home-split-discussions min-h-0">
            <HomeDiscussionSection previewLimit={8} />
          </div>
        ) : null}
        <div className="home-split-tasks min-h-0">
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
      </div>

      <div className="home-enter" style={homeStage(3)}>
        <HomeRecentActivity memberId={member.id} />
      </div>

      <div className="home-enter" style={homeStage(4)}>
        <HomeQuickStats
          member={member}
          upcomingEventCount={featuredEvents.length}
          tasksSummary={tasksSummary}
          pendingMemberApprovals={pendingMemberApprovals}
          financePendingCount={financePendingCount}
          isLoadingEvents={isLoading}
        />
      </div>
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const { summary } = useNotificationSummary();
  const [featuredEvents, setFeaturedEvents] = useState<EventResponse[]>([]);
  const [myTasks, setMyTasks] = useState<EventTaskResponse[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [taskCompleteError, setTaskCompleteError] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showAssistant = isRoleAtLeast(member.role, "board");
  const showTaskOversight = canViewTaskOversight(member.role, member.position);
  const tasksPath = getMyTasksPath(member.role);
  const tasksSummary = useMemo(() => summarizeMyTasks(myTasks), [myTasks]);
  const nextEvent = useMemo(
    () => findNextNonMeetingEvent(featuredEvents),
    [featuredEvents],
  );
  const financePendingCount = summary.finance_pending;
  const pendingMemberApprovals = summary.members_pending;

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
        const [upcoming, tasksResult] = await Promise.all([
          fetchUpcomingEvents({ limit: 10 }),
          fetchMyEventTasks().catch(() => ({
            tasks: [],
            total: 0,
          })),
        ]);

        if (cancelled) {
          return;
        }

        setFeaturedEvents(
          upcoming.events.filter((event) => event.event_type !== "meeting"),
        );
        setMyTasks(tasksResult.tasks);
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

  return (
    <MemberHomeLayout
      member={member}
      nextEvent={nextEvent}
      featuredEvents={featuredEvents}
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
