import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

function homeStage(stage: number): CSSProperties {
  return { ["--home-stage" as string]: stage };
}

import { CoverBanner } from "../components/CoverBanner";
import { HomeHeroBrand } from "../components/AppLogo";
import { HomeAdaptiveWorkspace } from "../components/home/HomeAdaptiveWorkspace";
import { HomeEditToolbar } from "../components/home/HomeEditToolbar";
import { HomeWidgetDrawer } from "../components/home/HomeWidgetDrawer";
import { useAuth } from "../context/useAuth";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import { useHomeWorkspace } from "../hooks/useHomeWorkspace";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchMyEventTasks,
  fetchTaskOverview,
  updateEventTask,
  type EventTaskResponse,
  type TaskOverviewMember,
} from "../lib/event-tasks-api";
import {
  fetchUpcomingEvents,
  type EventResponse,
} from "../lib/events-api";
import {
  applyOptimisticTaskComplete,
  buildHomeGreeting,
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
  myTasks: EventTaskResponse[];
  overviewMembers: TaskOverviewMember[];
  overviewLoading: boolean;
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
  onFeaturedEventsChange: (events: EventResponse[]) => void;
};

function MemberHomeLayout({
  member,
  featuredEvents,
  myTasks,
  overviewMembers,
  overviewLoading,
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
  onFeaturedEventsChange,
}: MemberHomeLayoutProps) {
  const workspace = useHomeWorkspace({
    memberId: member.id,
    showInbox: showAssistant,
    showPulse: showTaskOversight,
  });

  const firstName =
    member.full_name.trim().split(/\s+/).filter(Boolean)[0] ?? member.full_name;
  const nextEvent = featuredEvents[0] ?? null;
  const greeting = buildHomeGreeting({
    firstName,
    overdueCount: tasksSummary.overdueCount,
    nextEventName: nextEvent?.name,
    nextEventStartsAt: nextEvent?.starts_at,
  });

  return (
    <div
      className={[
        "home-dashboard home-dashboard--v4 home-dashboard--apple home-dashboard--nsa home-dashboard--adaptive flex w-full min-w-0 flex-col pb-12",
        workspace.isCustomizing ? "home-dashboard--editing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      <div
        className={[
          "home-enter home-workspace-toolbar",
          workspace.isCustomizing ? "is-editing" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={homeStage(0)}
      >
        <div>
          <h1 className="home-workspace-toolbar__title">Home</h1>
          {workspace.isCustomizing ? (
            <p className="home-workspace-toolbar__mode">Editing Layout</p>
          ) : (
            <div className="home-workspace-toolbar__briefing">
              <p className="home-workspace-toolbar__greeting">
                {greeting.salutation}
              </p>
              <p className="home-workspace-toolbar__detail">{greeting.detail}</p>
            </div>
          )}
        </div>
        {workspace.isCustomizing ? (
          <HomeEditToolbar
            onAddWidget={() => workspace.setWidgetDrawerOpen(true)}
            onReset={() => workspace.resetToDefault()}
            onDone={() => workspace.exitCustomize()}
          />
        ) : (
          <button
            type="button"
            className="home-workspace-toolbar__btn"
            onClick={() => workspace.enterCustomize()}
          >
            Customize
          </button>
        )}
      </div>

      <HomeWidgetDrawer
        open={workspace.widgetDrawerOpen}
        catalog={workspace.catalog}
        isHidden={workspace.isHidden}
        onToggle={workspace.toggleHidden}
        onClose={() => workspace.setWidgetDrawerOpen(false)}
      />

      <div className="home-enter" style={homeStage(1)}>
        <HomeAdaptiveWorkspace
          widgets={workspace.visible}
          isCustomizing={workspace.isCustomizing}
          selectedId={workspace.selectedId}
          member={member}
          featuredEvents={featuredEvents}
          myTasks={myTasks}
          overviewMembers={overviewMembers}
          overviewLoading={overviewLoading}
          tasksSummary={tasksSummary}
          isLoading={isLoading}
          financePendingCount={financePendingCount}
          pendingMemberApprovals={pendingMemberApprovals}
          showAssistant={showAssistant}
          showTaskOversight={showTaskOversight}
          tasksPath={tasksPath}
          completingTaskId={completingTaskId}
          taskCompleteError={taskCompleteError}
          onCompleteTask={onCompleteTask}
          onFeaturedEventsChange={onFeaturedEventsChange}
          onSelect={workspace.setSelectedId}
          onExitCustomize={workspace.exitCustomize}
          onToggleCollapsed={workspace.toggleCollapsed}
          onHide={workspace.hideWidget}
          onPatchWidget={workspace.patchWidget}
          onNudgeSelected={workspace.nudgeSelected}
        />
      </div>
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const { summary } = useNotificationSummary();
  const [featuredEvents, setFeaturedEvents] = useState<EventResponse[]>([]);
  const [myTasks, setMyTasks] = useState<EventTaskResponse[]>([]);
  const [overviewMembers, setOverviewMembers] = useState<TaskOverviewMember[]>(
    [],
  );
  const [overviewLoading, setOverviewLoading] = useState(false);
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
      if (showTaskOversight) {
        setOverviewLoading(true);
      }

      try {
        const [upcoming, tasksResult, overviewResult] = await Promise.all([
          fetchUpcomingEvents({ limit: 10 }),
          fetchMyEventTasks().catch(() => ({
            tasks: [],
            total: 0,
          })),
          showTaskOversight
            ? fetchTaskOverview().catch(() => ({
                members: [] as TaskOverviewMember[],
                total_tasks: 0,
                completed_tasks: 0,
              }))
            : Promise.resolve({
                members: [] as TaskOverviewMember[],
                total_tasks: 0,
                completed_tasks: 0,
              }),
        ]);

        if (cancelled) {
          return;
        }

        setFeaturedEvents(
          upcoming.events.filter((event) => event.event_type !== "meeting"),
        );
        setMyTasks(tasksResult.tasks);
        setOverviewMembers(overviewResult.members);
      } catch (caught) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setOverviewLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [member, showTaskOversight]);

  return (
    <MemberHomeLayout
      member={member}
      featuredEvents={featuredEvents}
      myTasks={myTasks}
      overviewMembers={overviewMembers}
      overviewLoading={overviewLoading}
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
      onFeaturedEventsChange={setFeaturedEvents}
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
