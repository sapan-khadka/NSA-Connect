import { useEffect, useMemo, useState } from "react";

import {
  HOME_WIDGET_CATALOG,
  densityForSize,
  getHomeWidgetMeta,
  loadHomeWorkspace,
  mergeWorkspaceWithCatalog,
  normalizeSpacing,
  nudgeWidget,
  placeWidgetFree,
  saveHomeWorkspace,
  setWidgetCollapsed,
  setWidgetHidden,
  visibleWorkspaceWidgets,
  type HomeWidgetId,
  type HomeWidgetLayout,
  type HomeWorkspaceState,
  type WidgetDensity,
} from "../lib/home-workspace";

export function useHomeWorkspace(opts: {
  memberId: number;
  showInbox: boolean;
  showPulse: boolean;
}) {
  const { memberId, showInbox, showPulse } = opts;
  const [state, setState] = useState<HomeWorkspaceState>(() =>
    mergeWorkspaceWithCatalog(null, {
      showInbox,
      showPulse,
    }),
  );
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [widgetDrawerOpen, setWidgetDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<HomeWidgetId | null>(null);

  useEffect(() => {
    setState(
      mergeWorkspaceWithCatalog(loadHomeWorkspace(memberId), {
        showInbox,
        showPulse,
      }),
    );
    setHydrated(true);
  }, [memberId, showInbox, showPulse]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveHomeWorkspace(memberId, state);
  }, [memberId, state, hydrated]);

  useEffect(() => {
    if (!isCustomizing) {
      setSelectedId(null);
      setWidgetDrawerOpen(false);
    }
  }, [isCustomizing]);

  const visible = useMemo(() => visibleWorkspaceWidgets(state), [state]);

  const catalog = useMemo(() => {
    return HOME_WIDGET_CATALOG.filter((item) => {
      if (item.id === "inbox") {
        /* Fixed right rail — not a canvas / drawer widget. */
        return false;
      }
      if (item.requiresBoard && !showInbox) {
        return false;
      }
      if (item.requiresOversight && !showPulse) {
        return false;
      }
      return true;
    });
  }, [showInbox, showPulse]);

  function densityOf(id: HomeWidgetId): WidgetDensity {
    const widget = state.widgets.find((item) => item.id === id);
    if (!widget) {
      const meta = getHomeWidgetMeta(id);
      return densityForSize(meta.defaultW, meta.defaultH);
    }
    return densityForSize(widget.w, widget.h);
  }

  function enterCustomize() {
    setIsCustomizing(true);
  }

  function exitCustomize() {
    setIsCustomizing(false);
    setWidgetDrawerOpen(false);
    setSelectedId(null);
  }

  return {
    state,
    visible,
    catalog,
    isCustomizing,
    widgetDrawerOpen,
    setWidgetDrawerOpen,
    enterCustomize,
    exitCustomize,
    selectedId,
    setSelectedId,
    densityOf,
    isHidden: (id: HomeWidgetId) =>
      Boolean(state.widgets.find((widget) => widget.id === id)?.hidden),
    toggleHidden: (id: HomeWidgetId) => {
      setState((current) => {
        const existing = current.widgets.find((widget) => widget.id === id);
        return setWidgetHidden(current, id, !existing?.hidden);
      });
    },
    hideWidget: (id: HomeWidgetId) => {
      setState((current) => setWidgetHidden(current, id, true));
    },
    toggleCollapsed: (id: HomeWidgetId) => {
      setState((current) => {
        const existing = current.widgets.find((widget) => widget.id === id);
        return setWidgetCollapsed(current, id, !existing?.collapsed);
      });
    },
    patchWidget: (id: HomeWidgetId, patch: Partial<HomeWidgetLayout>) => {
      setState((current) =>
        placeWidgetFree(current, id, {
          x: patch.x,
          y: patch.y,
          w: patch.w,
          h: patch.h,
          z: patch.z,
        }),
      );
    },
    nudgeSelected: (dx: number, dy: number) => {
      if (!isCustomizing || !selectedId) {
        return;
      }
      setState((current) => nudgeWidget(current, selectedId, dx, dy));
    },
    resetToDefault: () => {
      setState(
        mergeWorkspaceWithCatalog(null, {
          showInbox,
          showPulse,
          spacing: "loose",
        }),
      );
    },
  };
}
