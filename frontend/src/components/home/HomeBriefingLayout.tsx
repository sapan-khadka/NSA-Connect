import type { MemberResponse } from "../../lib/auth-api";
import type { EventTaskResponse, TaskOverviewMember } from "../../lib/event-tasks-api";
import type { EventResponse } from "../../lib/events-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import {
  orderVisibleWidgetsForBriefing,
  type HomeWidgetId,
} from "../../lib/home-workspace";
import { HomeFeaturedEvent } from "./HomeFeaturedEvent";
import { HomeMeetingMinutesCard } from "./HomeMeetingMinutesCard";
import { HomeQuickActions } from "./HomeQuickActions";
import { HomeRecentActivity } from "./HomeRecentActivity";
import { HomeTeamPulse } from "./HomeTeamPulse";
import { HomeTodaysFocus } from "./HomeTodaysFocus";
import { HomeUpcomingDeadlines } from "./HomeUpcomingDeadlines";
import { HomeUpcomingEvents } from "./HomeUpcomingEvents";
import { HomeWorkCenter } from "./HomeWorkCenter";

type HomeBriefingLayoutProps = {
  member: MemberResponse;
  featuredEvents: EventResponse[];
  myTasks: EventTaskResponse[];
  overviewMembers: TaskOverviewMember[];
  overviewLoading: boolean;
  tasksSummary: MyTasksSummary;
  isLoading: boolean;
  financePendingCount: number;
  pendingMemberApprovals: number;
  showAssistant: boolean;
  showTaskOversight: boolean;
  tasksPath: string;
  completingTaskId: number | null;
  taskCompleteError: string | null;
  onCompleteTask: (taskId: number) => void;
  /** Visible workspace widgets (Edit dashboard show/hide). */
  visibleWidgetIds: HomeWidgetId[];
};

/**
 * Reading Home — flat document flow driven by workspace visibility.
 * Freeform x/y only applies while customizing; Done returns here.
 */
export function HomeBriefingLayout({
  member,
  featuredEvents,
  myTasks,
  overviewMembers,
  overviewLoading,
  tasksSummary,
  isLoading,
  financePendingCount,
  pendingMemberApprovals,
  showAssistant,
  showTaskOversight,
  tasksPath,
  completingTaskId,
  taskCompleteError,
  onCompleteTask,
  visibleWidgetIds,
}: HomeBriefingLayoutProps) {
  const order = orderVisibleWidgetsForBriefing(visibleWidgetIds);
  const show = (id: HomeWidgetId) => order.includes(id);

  if (order.length === 0) {
    return (
      <div className="home-briefing">
        <p className="home-briefing__empty">
          No panels visible. Open Edit dashboard and show widgets to build your
          Home.
        </p>
      </div>
    );
  }

  const showTasks = show("tasks");
  const showActivity = show("activity");

  return (
    <div className="home-briefing">
      {show("featured") ? (
        <section className="home-briefing__section home-briefing__section--hero">
          <HomeFeaturedEvent
            events={featuredEvents}
            canManage={showAssistant}
            canCreateEvent={showAssistant}
            isLoading={isLoading}
            density="lg"
            contentScale={1}
            presentation="hero"
          />
        </section>
      ) : null}

      {show("overview") ? (
        <section className="home-briefing__section">
          <HomeTodaysFocus
            member={member}
            tasksSummary={tasksSummary}
            tasksPath={tasksPath}
            pendingMemberApprovals={pendingMemberApprovals}
            financePendingCount={financePendingCount}
            nextEvent={featuredEvents[0] ?? null}
            isLoading={isLoading}
          />
        </section>
      ) : null}

      {showTasks || showActivity ? (
        <div
          className={[
            "home-briefing__split",
            showTasks && showActivity ? "" : "is-single",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {showTasks ? (
            <section className="home-briefing__pane">
              <HomeWorkCenter
                member={member}
                tasksSummary={tasksSummary}
                tasksPath={tasksPath}
                isLoading={isLoading}
                completingTaskId={completingTaskId}
                taskCompleteError={taskCompleteError}
                onCompleteTask={onCompleteTask}
                taskLimit={8}
              />
            </section>
          ) : null}

          {showActivity ? (
            <section className="home-briefing__pane">
              <HomeRecentActivity memberId={member.id} limit={5} />
            </section>
          ) : null}
        </div>
      ) : null}

      {show("pulse") ? (
        <section className="home-briefing__section home-briefing__section--plain">
          <HomeTeamPulse
            members={overviewMembers}
            isLoading={overviewLoading}
            density="lg"
            pendingMemberApprovals={pendingMemberApprovals}
            financePendingCount={financePendingCount}
            nextEvent={featuredEvents[0] ?? null}
          />
        </section>
      ) : null}

      {show("upcoming") ? (
        <section className="home-briefing__section home-briefing__section--plain">
          <HomeUpcomingEvents
            events={featuredEvents}
            isLoading={isLoading}
            limit={5}
            skipFeatured
          />
        </section>
      ) : null}

      {show("deadlines") ? (
        <section className="home-briefing__section home-briefing__section--plain">
          <HomeUpcomingDeadlines
            personalTasks={myTasks}
            overviewMembers={overviewMembers}
            useOversight={showTaskOversight}
            isLoading={
              showTaskOversight ? overviewLoading : isLoading
            }
            tasksPath={tasksPath}
            limit={6}
          />
        </section>
      ) : null}

      {show("minutes") ? (
        <section className="home-briefing__section home-briefing__section--plain">
          <HomeMeetingMinutesCard />
        </section>
      ) : null}

      {show("actions") ? (
        <section className="home-briefing__section home-briefing__section--plain">
          <HomeQuickActions member={member} />
        </section>
      ) : null}
    </div>
  );
}
