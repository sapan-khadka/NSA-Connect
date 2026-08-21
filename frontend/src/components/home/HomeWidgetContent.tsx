import type { ReactNode } from "react";

import type { MemberResponse } from "../../lib/auth-api";
import type { EventTaskResponse, TaskOverviewMember } from "../../lib/event-tasks-api";
import type { EventResponse } from "../../lib/events-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import {
  contentFitScale,
  previewLimitForWidget,
  type HomeWidgetId,
  type WidgetDensity,
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

export type HomeWidgetData = {
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
};

export type HomeWidgetSurface = "briefing" | "canvas";

type HomeWidgetContentProps = {
  id: HomeWidgetId;
  surface: HomeWidgetSurface;
  data: HomeWidgetData;
  density?: WidgetDensity;
  screenWidth?: number;
  screenHeight?: number;
};

function deadlineRosterLimits(density: WidgetDensity): {
  memberLimit: number;
  tasksPerMember: number;
} {
  if (density === "xs" || density === "sm") {
    return { memberLimit: 4, tasksPerMember: 3 };
  }
  if (density === "md") {
    return { memberLimit: 8, tasksPerMember: 5 };
  }
  return { memberLimit: 14, tasksPerMember: 8 };
}

/**
 * Shared Home widget body used by the reading briefing and the edit canvas.
 * Surfaces keep their own chrome and list limits.
 */
export function HomeWidgetContent({
  id,
  surface,
  data,
  density = "lg",
  screenWidth = 0,
  screenHeight = 0,
}: HomeWidgetContentProps): ReactNode {
  const nextEvent = data.featuredEvents[0] ?? null;
  const isCanvas = surface === "canvas";

  switch (id) {
    case "featured":
      return (
        <HomeFeaturedEvent
          events={data.featuredEvents}
          canManage={data.showAssistant}
          canCreateEvent={data.showAssistant}
          isLoading={data.isLoading}
          density={isCanvas ? density : "lg"}
          contentScale={
            isCanvas ? contentFitScale(screenWidth, screenHeight) : 1
          }
          presentation={
            isCanvas && (density === "xs" || density === "sm")
              ? "strip"
              : "hero"
          }
        />
      );
    case "overview":
      return (
        <HomeTodaysFocus
          member={data.member}
          tasksSummary={data.tasksSummary}
          tasksPath={data.tasksPath}
          pendingMemberApprovals={data.pendingMemberApprovals}
          financePendingCount={data.financePendingCount}
          nextEvent={nextEvent}
          isLoading={data.isLoading}
        />
      );
    case "actions":
      return <HomeQuickActions member={data.member} />;
    case "tasks":
      return (
        <HomeWorkCenter
          member={data.member}
          tasksSummary={data.tasksSummary}
          tasksPath={data.tasksPath}
          isLoading={data.isLoading}
          completingTaskId={data.completingTaskId}
          taskCompleteError={data.taskCompleteError}
          onCompleteTask={data.onCompleteTask}
          taskLimit={
            isCanvas
              ? previewLimitForWidget(density, "tasks", screenHeight)
              : 8
          }
        />
      );
    case "inbox":
      /* Inbox is rendered as a fixed right rail — not a Home canvas widget. */
      return null;
    case "activity":
      return (
        <HomeRecentActivity
          memberId={data.member.id}
          {...(isCanvas
            ? {
                limit: Math.min(
                  3,
                  previewLimitForWidget(density, "activity", screenHeight),
                ),
              }
            : {})}
        />
      );
    case "upcoming":
      return (
        <HomeUpcomingEvents
          events={data.featuredEvents}
          isLoading={data.isLoading}
          limit={
            isCanvas
              ? previewLimitForWidget(density, "events", screenHeight)
              : 5
          }
          skipFeatured
        />
      );
    case "deadlines": {
      const roster = isCanvas
        ? deadlineRosterLimits(density)
        : { memberLimit: 14, tasksPerMember: 8 };
      return (
        <HomeUpcomingDeadlines
          personalTasks={data.myTasks}
          overviewMembers={data.overviewMembers}
          useOversight={data.showTaskOversight}
          isLoading={
            data.showTaskOversight ? data.overviewLoading : data.isLoading
          }
          tasksPath={data.tasksPath}
          {...(isCanvas
            ? {
                limit: previewLimitForWidget(
                  density,
                  "deadlines",
                  screenHeight,
                ),
              }
            : {})}
          memberLimit={roster.memberLimit}
          tasksPerMember={roster.tasksPerMember}
        />
      );
    }
    case "pulse":
      return (
        <HomeTeamPulse
          members={data.overviewMembers}
          isLoading={data.overviewLoading}
          density={isCanvas ? density : "lg"}
          pendingMemberApprovals={data.pendingMemberApprovals}
          financePendingCount={data.financePendingCount}
          nextEvent={nextEvent}
        />
      );
    case "minutes":
      return <HomeMeetingMinutesCard />;
    default:
      return null;
  }
}
