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
import { pickFocusMeeting } from "../components/home/HomeMeetingMinutesCard";
import { HomeQuickStats } from "../components/home/HomeQuickStats";
import { HomeRecentActivity } from "../components/home/HomeRecentActivity";
import { HomeTodayGlance } from "../components/home/HomeTodayGlance";
import {
  buildHomeUrgencyChips,
  HomeUrgencyChips,
} from "../components/home/HomeUrgencyChips";
import { HomeWorkCenter } from "../components/home/HomeWorkCenter";
import { HomeDiscussionSection } from "../components/HomeDiscussionSection";
import { useAuth } from "../context/useAuth";
import { useNotificationSummary } from "../context/NotificationSummaryProvider";
import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchDiscussionInbox } from "../lib/discussion-api";
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
import { fetchMeetings } from "../lib/meetings-api";
import {
  canManageTreasury,
  canViewMemberDirectory,
  canViewTaskOversight,
  isRoleAtLeast,
} from "../lib/roles";
import { isSameLocalDay } from "../components/home/HomeTodayTimeline";

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
  todayEvents: EventResponse[];
  tasksSummary: ReturnType<typeof summarizeMyTasks>;
  isLoading: boolean;
  loadError: string | null;
  financePendingCount: number;
  pendingMemberApprovals: number;
  notesNeededPath: string | null;
  showAssistant: boolean;
  showTaskOversight: boolean;
  tasksPath: string;
  completingTaskId: number | null;
  taskCompleteError: string | null;
  onCompleteTask: (taskId: number) => void;
  discussionCount: number;
};

function MemberHomeLayout({
  member,
  nextEvent,
  featuredEvents,
  todayEvents,
  tasksSummary,
  isLoading,
  loadError,
  financePendingCount,
  pendingMemberApprovals,
  notesNeededPath,
  showAssistant,
  showTaskOversight,
  tasksPath,
  completingTaskId,
  taskCompleteError,
  onCompleteTask,
  discussionCount,
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
    notesNeededPath,
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

  return (
    <div className="home-dashboard home-dashboard--board mx-auto flex w-full max-w-[1180px] flex-col gap-3.5 pb-8">
      {loadError ? (
        <div role="alert" className="ds-alert-banner shrink-0">
          {loadError}
        </div>
      ) : null}

      <div className="home-enter home-dashboard-welcome shrink-0" style={homeStage(0)}>
        <HomeWelcomeBanner member={member} calmLine={calmLine} />
        <HomeUrgencyChips chips={urgencyChips} />
      </div>

      <div
        className={[
          "home-enter home-board",
          showAssistant ? "home-board--with-rail" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={homeStage(1)}
      >
        <div className="home-board-featured min-h-0">
          <HomeFeaturedEvent
            events={featuredEvents}
            canManage={showAssistant}
            canCreateEvent={showAssistant}
            isLoading={isLoading}
          />
        </div>

        {showAssistant ? (
          <aside className="home-board-discussions min-h-0">
            <HomeDiscussionSection previewLimit={3} />
          </aside>
        ) : null}

        <div className="home-board-work min-h-0">
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

        <aside className="home-board-glance min-h-0">
          <HomeTodayGlance
            events={todayEvents}
            tasksSummary={tasksSummary}
            discussionCount={discussionCount}
            isLoading={isLoading}
          />
        </aside>

        <div className="home-board-stats min-h-0">
          <HomeQuickStats
            member={member}
            upcomingEventCount={featuredEvents.length}
            tasksSummary={tasksSummary}
            pendingMemberApprovals={pendingMemberApprovals}
            financePendingCount={financePendingCount}
            isLoadingEvents={isLoading}
          />
        </div>

        <div className="home-board-activity min-h-0">
          <HomeRecentActivity memberId={member.id} />
        </div>
      </div>
    </div>
  );
}

function MemberHomeView({ member }: { member: MemberResponse }) {
  const { summary } = useNotificationSummary();
  const [featuredEvents, setFeaturedEvents] = useState<EventResponse[]>([]);
  const [todayEvents, setTodayEvents] = useState<EventResponse[]>([]);
  const [myTasks, setMyTasks] = useState<EventTaskResponse[]>([]);
  const [discussionCount, setDiscussionCount] = useState(0);
  const [notesNeededPath, setNotesNeededPath] = useState<string | null>(null);
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

        const nonMeetingUpcoming = upcoming.events.filter(
          (event) => event.event_type !== "meeting",
        );
        setFeaturedEvents(nonMeetingUpcoming);
        setTodayEvents(upcoming.events.filter((event) => isSameLocalDay(event.starts_at)));
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

  useEffect(() => {
    if (!showAssistant) {
      setDiscussionCount(0);
      return;
    }
    let cancelled = false;
    void fetchDiscussionInbox()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const active = response.rooms.filter(
          (room) =>
            room.unread_count > 0 ||
            (room.last_message_at != null &&
              isSameLocalDay(room.last_message_at)),
        );
        setDiscussionCount(
          active.length > 0 ? active.length : Math.min(response.rooms.length, 2),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setDiscussionCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showAssistant, member.id]);

  useEffect(() => {
    if (!showAssistant) {
      setNotesNeededPath(null);
      return;
    }

    let cancelled = false;

    void fetchMeetings()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const focus = pickFocusMeeting(response.meetings);
        if (focus && !focus.has_minutes) {
          setNotesNeededPath(
            `/events/meetings/${focus.event_id}#meeting-minutes`,
          );
        } else {
          setNotesNeededPath(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotesNeededPath(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showAssistant, member.id]);

  return (
    <MemberHomeLayout
      member={member}
      nextEvent={nextEvent}
      featuredEvents={featuredEvents}
      todayEvents={todayEvents}
      tasksSummary={tasksSummary}
      isLoading={isLoading}
      loadError={loadError}
      financePendingCount={financePendingCount}
      pendingMemberApprovals={pendingMemberApprovals}
      notesNeededPath={notesNeededPath}
      showAssistant={showAssistant}
      showTaskOversight={showTaskOversight}
      tasksPath={tasksPath}
      completingTaskId={completingTaskId}
      taskCompleteError={taskCompleteError}
      onCompleteTask={(taskId) => {
        void handleCompleteTask(taskId);
      }}
      discussionCount={discussionCount}
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
