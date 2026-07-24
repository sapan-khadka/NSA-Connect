import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

function homeStage(stage: number): CSSProperties {
  return { ["--home-stage" as string]: stage };
}

import { CoverBanner } from "../components/CoverBanner";
import { HomeHeroBrand } from "../components/AppLogo";
import { HomeFeaturedEvent } from "../components/home/HomeFeaturedEvent";
import { HomeQuickActions } from "../components/home/HomeQuickActions";
import { HomeQuickStats } from "../components/home/HomeQuickStats";
import { HomeRecentActivity } from "../components/home/HomeRecentActivity";
import { HomeWorkCenter } from "../components/home/HomeWorkCenter";
import { HomeDiscussionSection } from "../components/HomeDiscussionSection";
import { useAuth } from "../context/useAuth";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { useMediaQuery } from "../hooks/useMediaQuery";
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
  const isMobile = useMediaQuery("(max-width: 767px)");
  const discussionLimit = isMobile ? 4 : 8;
  const activityLimit = isMobile ? 6 : 12;

  return (
    <div className="home-dashboard home-dashboard--v4 home-dashboard--apple flex w-full min-w-0 flex-col pb-8">
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      <div
        className={[
          "home-enter home-top-split",
          showAssistant ? "home-top-split--with-discussions" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={homeStage(0)}
      >
        <div className="home-top-split__banner">
          <HomeFeaturedEvent
            events={featuredEvents}
            canManage={showAssistant}
            canCreateEvent={showAssistant}
            isLoading={isLoading}
          />
        </div>
        <aside className="home-top-split__side" aria-label="Home overview">
          <HomeQuickStats
            member={member}
            upcomingEventCount={featuredEvents.length}
            tasksSummary={tasksSummary}
            pendingMemberApprovals={pendingMemberApprovals}
            financePendingCount={financePendingCount}
            isLoadingEvents={isLoading}
          />
          <HomeQuickActions member={member} />
        </aside>
      </div>

      <div
        className={[
          "home-enter home-main-columns",
          showAssistant ? "home-main-columns--with-discussions" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={homeStage(1)}
      >
        <div className="home-col home-col--tasks min-h-0">
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

        {showAssistant ? (
          <div className="home-col home-col--discussions min-h-0">
            <HomeDiscussionSection previewLimit={discussionLimit} />
          </div>
        ) : null}

        <div className="home-col home-col--rail min-h-0">
          <HomeRecentActivity memberId={member.id} limit={activityLimit} />
        </div>
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
