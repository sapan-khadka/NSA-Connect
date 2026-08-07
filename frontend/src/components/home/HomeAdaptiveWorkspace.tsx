import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { MemberResponse } from "../../lib/auth-api";
import type { EventTaskResponse, TaskOverviewMember } from "../../lib/event-tasks-api";
import type { EventResponse } from "../../lib/events-api";
import type { MyTasksSummary } from "../../lib/home-tasks";
import { useIsLgUp } from "../../hooks/useMediaQuery";
import {
  HOME_CANVAS_DESIGN_WIDTH,
  HOME_COARSE_SNAP_PX,
  HOME_GRID_COL_PX,
  HOME_GRID_ROW_PX,
  applyResizeDelta,
  canvasHeight,
  contentFitScale,
  cycleSizePreset,
  densityForSize,
  designToScreen,
  detectSizePreset,
  effectiveHeight,
  measureScale,
  normalizeWidget,
  previewLimitForWidget,
  rectForWidget,
  screenToDesign,
  snapRectToGuides,
  softSnapToGridPx,
  type AlignmentGuide,
  type HomeWidgetId,
  type HomeWidgetLayout,
  type ResizeHandle,
  type ScaleMetrics,
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
import { HomeWidgetShell } from "./HomeWidgetShell";
import { HomeWorkCenter } from "./HomeWorkCenter";

type HomeAdaptiveWorkspaceProps = {
  widgets: HomeWidgetLayout[];
  isCustomizing: boolean;
  selectedId: HomeWidgetId | null;
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
  onFeaturedEventsChange: (events: EventResponse[]) => void;
  onSelect: (id: HomeWidgetId | null) => void;
  onEnterCustomize: () => void;
  onExitCustomize: () => void;
  onToggleCollapsed: (id: HomeWidgetId) => void;
  onHide: (id: HomeWidgetId) => void;
  onPatchWidget: (id: HomeWidgetId, patch: Partial<HomeWidgetLayout>) => void;
  onNudgeSelected: (dx: number, dy: number) => void;
};

type DragSession =
  | {
      mode: "move";
      id: HomeWidgetId;
      origin: HomeWidgetLayout;
      pointerOffsetX: number;
      pointerOffsetY: number;
    }
  | {
      mode: "resize";
      id: HomeWidgetId;
      origin: HomeWidgetLayout;
      handle: ResizeHandle;
      startClientX: number;
      startClientY: number;
    };

function renderWidgetContent(
  id: HomeWidgetId,
  density: WidgetDensity,
  screenWidth: number,
  screenHeight: number,
  props: HomeAdaptiveWorkspaceProps,
): ReactNode {
  switch (id) {
    case "featured":
      return (
        <HomeFeaturedEvent
          events={props.featuredEvents}
          canManage={props.showAssistant}
          canCreateEvent={props.showAssistant}
          isLoading={props.isLoading}
          density={density}
          contentScale={contentFitScale(screenWidth, screenHeight)}
          presentation={
            density === "xs" || density === "sm" ? "strip" : "hero"
          }
        />
      );
    case "overview":
      return (
        <HomeTodaysFocus
          member={props.member}
          tasksSummary={props.tasksSummary}
          tasksPath={props.tasksPath}
          pendingMemberApprovals={props.pendingMemberApprovals}
          financePendingCount={props.financePendingCount}
          nextEvent={props.featuredEvents[0] ?? null}
          isLoading={props.isLoading}
        />
      );
    case "actions":
      return <HomeQuickActions member={props.member} />;
    case "tasks":
      return (
        <HomeWorkCenter
          member={props.member}
          tasksSummary={props.tasksSummary}
          tasksPath={props.tasksPath}
          isLoading={props.isLoading}
          completingTaskId={props.completingTaskId}
          taskCompleteError={props.taskCompleteError}
          onCompleteTask={props.onCompleteTask}
          taskLimit={previewLimitForWidget(density, "tasks", screenHeight)}
        />
      );
    case "inbox":
      /* Inbox is rendered as a fixed right rail on Home — not a canvas widget. */
      return null;
    case "activity":
      return (
        <HomeRecentActivity
          memberId={props.member.id}
          limit={Math.min(
            3,
            previewLimitForWidget(density, "activity", screenHeight),
          )}
        />
      );
    case "upcoming":
      return (
        <HomeUpcomingEvents
          events={props.featuredEvents}
          isLoading={props.isLoading}
          limit={previewLimitForWidget(density, "events", screenHeight)}
          skipFeatured
        />
      );
    case "deadlines":
      return (
        <HomeUpcomingDeadlines
          personalTasks={props.myTasks}
          overviewMembers={props.overviewMembers}
          useOversight={props.showTaskOversight}
          isLoading={
            props.showTaskOversight ? props.overviewLoading : props.isLoading
          }
          tasksPath={props.tasksPath}
          limit={previewLimitForWidget(density, "deadlines", screenHeight)}
          memberLimit={
            density === "xs" || density === "sm"
              ? 4
              : density === "md"
                ? 8
                : 14
          }
          tasksPerMember={
            density === "xs" || density === "sm"
              ? 3
              : density === "md"
                ? 5
                : 8
          }
        />
      );
    case "pulse":
      return (
        <HomeTeamPulse
          members={props.overviewMembers}
          isLoading={props.overviewLoading}
          density={density}
          pendingMemberApprovals={props.pendingMemberApprovals}
          financePendingCount={props.financePendingCount}
          nextEvent={props.featuredEvents[0] ?? null}
        />
      );
    case "minutes":
      return <HomeMeetingMinutesCard />;
    default:
      return null;
  }
}

function sizeLabelFor(widget: HomeWidgetLayout): string {
  return `${Math.round(widget.w)} × ${Math.round(effectiveHeight(widget))} px`;
}

function sortWidgetsForStack(widgets: HomeWidgetLayout[]): HomeWidgetLayout[] {
  return [...widgets].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    return a.id.localeCompare(b.id);
  });
}

export function HomeAdaptiveWorkspace(props: HomeAdaptiveWorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isDesktopCanvas = useIsLgUp();
  const [metrics, setMetrics] = useState<ScaleMetrics>(() =>
    measureScale(HOME_CANVAS_DESIGN_WIDTH),
  );
  const [draft, setDraft] = useState<HomeWidgetLayout[] | null>(null);
  const [session, setSession] = useState<DragSession | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const widgets = draft ?? props.widgets;
  const height = canvasHeight(widgets);
  const scale = metrics.scale;
  const offsetX = metrics.offsetX;
  const isCustomizing = props.isCustomizing && isDesktopCanvas;

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) {
      return;
    }
    const sync = () => {
      setMetrics(measureScale(node.clientWidth || HOME_CANVAS_DESIGN_WIDTH));
    };
    sync();

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(sync)
        : null;
    observer?.observe(node);

    /* Browser zoom often changes layout width without a ResizeObserver tick. */
    window.addEventListener("resize", sync);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", sync);
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
    };
  }, []);

  /* Only tear down an active gesture when leaving customize — never when
   * entering it mid-drag (Move / grip can call onEnterCustomize + beginMove). */
  const wasCustomizingRef = useRef(isCustomizing);
  useEffect(() => {
    if (wasCustomizingRef.current && !isCustomizing) {
      setSession(null);
      setDraft(null);
      setGuides([]);
    }
    wasCustomizingRef.current = isCustomizing;
  }, [isCustomizing]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!isCustomizing || session) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        props.onExitCustomize();
        return;
      }
      if (!props.selectedId) {
        return;
      }
      const step = event.shiftKey ? HOME_COARSE_SNAP_PX : 1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        props.onNudgeSelected(-step, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        props.onNudgeSelected(step, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        props.onNudgeSelected(0, -step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        props.onNudgeSelected(0, step);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props, session, isCustomizing]);

  useEffect(() => {
    if (!session) {
      return;
    }

    function onPointerMove(event: PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas || !session) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const snapStep = event.shiftKey ? HOME_COARSE_SNAP_PX : 1;
      const magnetsOn = !event.altKey;

      setDraft((current) => {
        const base = current ?? props.widgets;
        const others = base.filter((item) => item.id !== session.id);
        let nextGuides: AlignmentGuide[] = [];
        const next = base.map((item) => {
          if (item.id !== session.id) {
            return item;
          }
          if (session.mode === "move") {
            const localX =
              event.clientX - rect.left - session.pointerOffsetX;
            const localY =
              event.clientY - rect.top - session.pointerOffsetY;
            const raw = {
              x: screenToDesign(localX - offsetX, scale),
              y: screenToDesign(localY, scale),
              w: session.origin.w,
              h: session.origin.h,
            };
            /* Live move stays pixel-smooth; grid snap happens on release. */
            const snapped = magnetsOn
              ? snapRectToGuides(raw, others, {
                  snapStep,
                  threshold: 10,
                })
              : {
                  ...raw,
                  guides: [] as AlignmentGuide[],
                };
            nextGuides = snapped.guides;
            return normalizeWidget({
              ...item,
              x: snapped.x,
              y: snapped.y,
              w: snapped.w,
              h: snapped.h,
            });
          }

          const deltaX = screenToDesign(
            event.clientX - session.startClientX,
            scale,
          );
          const deltaY = screenToDesign(
            event.clientY - session.startClientY,
            scale,
          );
          const resized = applyResizeDelta(
            session.origin,
            session.handle,
            deltaX,
            deltaY,
          );
          /*
           * Live resize stays pixel-smooth. Magnet guides are move-oriented
           * (they translate x/y) and make SE resize feel jumpy — skip them here.
           * Shift still coarse-snaps size.
           */
          const nextRect =
            snapStep > 1
              ? {
                  x: session.origin.x,
                  y: session.origin.y,
                  w: Math.round(resized.w / snapStep) * snapStep,
                  h: Math.round(resized.h / snapStep) * snapStep,
                }
              : resized;
          nextGuides = [];
          return normalizeWidget({
            ...item,
            x: nextRect.x,
            y: nextRect.y,
            w: nextRect.w,
            h: nextRect.h,
          });
        });
        queueMicrotask(() => setGuides(nextGuides));
        return next;
      });
    }

    function onPointerUp() {
      setDraft((current) => {
        if (current && session) {
          const widget = current.find((item) => item.id === session.id);
          if (widget) {
            const settled = normalizeWidget({
              ...widget,
              x: softSnapToGridPx(widget.x, HOME_GRID_COL_PX),
              y: softSnapToGridPx(widget.y, HOME_GRID_ROW_PX),
              w: softSnapToGridPx(widget.w, HOME_GRID_COL_PX),
              h: softSnapToGridPx(widget.h, HOME_GRID_ROW_PX),
            });
            props.onPatchWidget(session.id, {
              x: settled.x,
              y: settled.y,
              w: settled.w,
              h: settled.h,
              z: settled.z,
            });
          }
        }
        return null;
      });
      setGuides([]);
      setSession(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [session, scale, offsetX, props, isCustomizing]);

  function beginMove(
    widget: HomeWidgetLayout,
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (!isDesktopCanvas) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!props.isCustomizing) {
      props.onEnterCustomize();
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom / unsupported — ignore */
    }
    const rect = canvas.getBoundingClientRect();
    const box = rectForWidget(widget, scale, offsetX);
    props.onSelect(widget.id);
    setDraft(props.widgets);
    setSession({
      mode: "move",
      id: widget.id,
      origin: widget,
      pointerOffsetX: event.clientX - rect.left - box.left,
      pointerOffsetY: event.clientY - rect.top - box.top,
    });
  }

  function beginResize(
    widget: HomeWidgetLayout,
    handle: ResizeHandle,
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (!isDesktopCanvas) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!props.isCustomizing) {
      props.onEnterCustomize();
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom / unsupported — ignore */
    }
    props.onSelect(widget.id);
    setDraft(props.widgets);
    setSession({
      mode: "resize",
      id: widget.id,
      origin: widget,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  }

  const orderedWidgets = isDesktopCanvas
    ? [...widgets].sort((a, b) => (a.z ?? 1) - (b.z ?? 1))
    : sortWidgetsForStack(widgets);

  const stackWidth = Math.max(280, metrics.canvasWidth || 360);

  return (
    <div
      ref={canvasRef}
      className={[
        "home-canvas",
        "home-canvas--pixel",
        isDesktopCanvas ? "" : "home-canvas--stack",
        isCustomizing ? "is-customizing" : "",
        session ? "is-editing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Home workspace canvas"
      style={
        isDesktopCanvas
          ? {
              height: designToScreen(height, scale),
              position: "relative",
            }
          : {
              height: "auto",
              minHeight: 0,
              position: "relative",
            }
      }
      onPointerDown={(event) => {
        if (!isCustomizing) {
          return;
        }
        if (event.target === event.currentTarget) {
          props.onSelect(null);
        }
      }}
    >
      {isCustomizing
        ? guides.map((guide) =>
            guide.orientation === "x" ? (
              <div
                key={`gx-${guide.at}`}
                className="home-canvas__guide home-canvas__guide--x"
                style={{ left: designToScreen(guide.at, scale) + offsetX }}
              />
            ) : (
              <div
                key={`gy-${guide.at}`}
                className="home-canvas__guide home-canvas__guide--y"
                style={{ top: designToScreen(guide.at, scale) }}
              />
            ),
          )
        : null}

      {orderedWidgets.map((widget) => {
        const box = rectForWidget(widget, scale, offsetX);
        const screenW = isDesktopCanvas ? box.width : stackWidth;
        const screenH = isDesktopCanvas
          ? box.height
          : Math.max(180, Math.min(420, widget.h * 0.85));
        const density = densityForSize(screenW, screenH);
        const dragging = session?.id === widget.id;
        return (
          <HomeWidgetShell
            key={widget.id}
            id={widget.id}
            density={density}
            collapsed={widget.collapsed}
            active={dragging}
            selected={
              dragging || (isCustomizing && props.selectedId === widget.id)
            }
            isCustomizing={isCustomizing || dragging}
            sizePreset={detectSizePreset(widget)}
            screenWidth={screenW}
            screenHeight={screenH}
            sizeLabel={
              dragging || (isCustomizing && props.selectedId === widget.id)
                ? sizeLabelFor(widget)
                : null
            }
            style={
              isDesktopCanvas
                ? {
                    position: "absolute",
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    zIndex: dragging ? 1000 : (widget.z ?? 1),
                  }
                : {
                    position: "relative",
                    left: "auto",
                    top: "auto",
                    width: "100%",
                    height: "auto",
                    zIndex: "auto",
                  }
            }
            onSelect={() => props.onSelect(widget.id)}
            onEnterCustomize={props.onEnterCustomize}
            onToggleCollapsed={() => props.onToggleCollapsed(widget.id)}
            onHide={() => props.onHide(widget.id)}
            onCycleSize={() => {
              const next = cycleSizePreset(widget);
              props.onPatchWidget(widget.id, next);
            }}
            onDragPointerDown={(event) => beginMove(widget, event)}
            onResizePointerDown={(handle, event) =>
              beginResize(widget, handle, event)
            }
          >
            {renderWidgetContent(widget.id, density, screenW, screenH, props)}
          </HomeWidgetShell>
        );
      })}

      {isCustomizing ? (
        <p className="home-canvas__hint">
          Drag the ⋮⋮ grip to move · corner to resize · Esc when done
        </p>
      ) : null}
    </div>
  );
}
