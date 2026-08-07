import { describe, expect, it } from "vitest";

import {
  HOME_CANVAS_DESIGN_WIDTH,
  HOME_CANVAS_MAX_SCALE,
  HOME_SPACING_GAP_PX,
  applyLayoutSpacing,
  applyResizeDelta,
  buildDefaultWorkspace,
  contentFitScale,
  cycleSizePreset,
  densityForSize,
  detectSizePreset,
  layoutHasOverlaps,
  measureScale,
  mergeWorkspaceWithCatalog,
  moveWidget,
  normalizeWidget,
  orderVisibleWidgetsForBriefing,
  packWidgets,
  placeWidgetFree,
  previewLimitForDensity,
  previewLimitForWidget,
  resizeWidget,
  setWidgetHidden,
  snapRectToGuides,
  softSnapToGridPx,
  visibleWorkspaceWidgets,
  widgetsOverlap,
} from "./home-workspace";

describe("home-workspace pixel canvas", () => {
  it("caps canvas scale and centers the board on ultrawide / zoomed-out widths", () => {
    const fitted = measureScale(HOME_CANVAS_DESIGN_WIDTH);
    expect(fitted.scale).toBe(1);
    expect(fitted.offsetX).toBe(0);

    const wide = measureScale(HOME_CANVAS_DESIGN_WIDTH * 3);
    expect(wide.scale).toBe(HOME_CANVAS_MAX_SCALE);
    expect(wide.offsetX).toBeGreaterThan(100);
    expect(
      wide.offsetX * 2 + HOME_CANVAS_DESIGN_WIDTH * wide.scale,
    ).toBeCloseTo(wide.canvasWidth, 0);
  });

  it("builds a board briefing: event banner, focus, tasks, and activity only", () => {
    const state = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    expect(layoutHasOverlaps(state.widgets)).toBe(false);
    expect(state.spacing).toBe("loose");
    expect(state.version).toBe(18);

    const visible = visibleWorkspaceWidgets(state).map((widget) => widget.id);
    expect(visible).toEqual(["featured", "overview", "tasks", "activity"]);
    expect(visible).not.toContain("inbox");
    expect(visible).not.toContain("minutes");
    expect(visible).not.toContain("deadlines");
    expect(visible).not.toContain("actions");
    expect(visible).not.toContain("pulse");
    expect(visible).not.toContain("upcoming");

    const featured = state.widgets.find((widget) => widget.id === "featured")!;
    const overview = state.widgets.find((widget) => widget.id === "overview")!;
    const tasks = state.widgets.find((widget) => widget.id === "tasks")!;
    const activity = state.widgets.find((widget) => widget.id === "activity")!;
    const inbox = state.widgets.find((widget) => widget.id === "inbox")!;

    expect(featured.w).toBe(HOME_CANVAS_DESIGN_WIDTH);
    expect(overview.w).toBe(HOME_CANVAS_DESIGN_WIDTH);
    expect(overview.y).toBeGreaterThan(featured.y);
    expect(tasks.y).toBeGreaterThan(overview.y);
    expect(activity.y).toBe(tasks.y);
    expect(activity.h).toBeLessThanOrEqual(tasks.h);
    expect(inbox.hidden).toBe(true);
  });

  it("builds the same board briefing without oversight-only catalog extras", () => {
    const state = buildDefaultWorkspace({ showInbox: true, showPulse: false });
    const visible = visibleWorkspaceWidgets(state).map((w) => w.id);
    expect(visible).toEqual(["featured", "overview", "tasks", "activity"]);
    expect(visible).not.toContain("inbox");
    expect(visible).not.toContain("pulse");
    expect(visible).not.toContain("upcoming");
    expect(layoutHasOverlaps(state.widgets)).toBe(false);
  });

  it("builds a member briefing with event banner, focus, and full-width tasks", () => {
    const state = buildDefaultWorkspace({ showInbox: false, showPulse: false });
    const visible = visibleWorkspaceWidgets(state).map((w) => w.id);
    expect(visible).toEqual(["featured", "overview", "tasks"]);
    expect(state.widgets.find((w) => w.id === "inbox")?.hidden).toBe(true);
    expect(state.widgets.find((w) => w.id === "activity")?.hidden).toBe(true);
    expect(state.widgets.find((w) => w.id === "upcoming")?.hidden).toBe(true);
    expect(layoutHasOverlaps(state.widgets)).toBe(false);

    const tasks = state.widgets.find((w) => w.id === "tasks")!;
    expect(tasks.w).toBe(HOME_CANVAS_DESIGN_WIDTH);
  });

  it("keeps secondary widgets parked on the default briefing layout", () => {
    const state = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    for (const id of [
      "actions",
      "minutes",
      "deadlines",
      "inbox",
      "pulse",
      "upcoming",
    ] as const) {
      expect(state.widgets.find((item) => item.id === id)?.hidden).toBe(true);
    }
    expect(layoutHasOverlaps(state.widgets)).toBe(false);
  });

  it("does not overlap after merging the default board layout", () => {
    const saved = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const merged = mergeWorkspaceWithCatalog(saved, {
      showInbox: true,
      showPulse: true,
    });
    expect(layoutHasOverlaps(merged.widgets)).toBe(false);
    const overview = merged.widgets.find((widget) => widget.id === "overview")!;
    const tasks = merged.widgets.find((widget) => widget.id === "tasks")!;
    const activity = merged.widgets.find((widget) => widget.id === "activity")!;
    const featured = merged.widgets.find((widget) => widget.id === "featured")!;
    expect(overview.y).toBeGreaterThan(featured.y);
    expect(tasks.y).toBeGreaterThan(overview.y);
    expect(activity.y).toBe(tasks.y);
    expect(merged.widgets.find((widget) => widget.id === "inbox")?.hidden).toBe(
      true,
    );
  });

  it("repairs overlapping minutes against organization", () => {
    const saved = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const overview = saved.widgets.find((widget) => widget.id === "overview")!;
    saved.widgets = saved.widgets.map((item) => {
      if (item.id === "minutes") {
        return {
          ...item,
          hidden: false,
          x: overview.x,
          y: overview.y + 40,
          w: overview.w,
          h: 160,
        };
      }
      return item;
    });
    expect(layoutHasOverlaps(saved.widgets)).toBe(true);
    const merged = mergeWorkspaceWithCatalog(saved, {
      showInbox: true,
      showPulse: true,
    });
    expect(layoutHasOverlaps(merged.widgets)).toBe(false);
  });

  it("packs tight spacing with smaller gaps than loose", () => {
    const loose = buildDefaultWorkspace({
      showInbox: true,
      showPulse: true,
      spacing: "loose",
    });
    const tight = buildDefaultWorkspace({
      showInbox: true,
      showPulse: true,
      spacing: "tight",
    });
    expect(layoutHasOverlaps(tight.widgets)).toBe(false);
    expect(tight.spacing).toBe("tight");

    const looseFeatured = loose.widgets.find((w) => w.id === "featured")!;
    const looseOverview = loose.widgets.find((w) => w.id === "overview")!;
    const tightFeatured = tight.widgets.find((w) => w.id === "featured")!;
    const tightOverview = tight.widgets.find((w) => w.id === "overview")!;

    const looseGap = looseOverview.y - (looseFeatured.y + looseFeatured.h);
    const tightGap = tightOverview.y - (tightFeatured.y + tightFeatured.h);
    expect(looseGap).toBe(HOME_SPACING_GAP_PX.loose);
    expect(tightGap).toBe(HOME_SPACING_GAP_PX.tight);
    expect(tightGap).toBeLessThan(looseGap);
  });

  it("applyLayoutSpacing reflows gaps immediately and keeps hidden widgets", () => {
    const loose = buildDefaultWorkspace({
      showInbox: true,
      showPulse: true,
      spacing: "loose",
    });
    const withHidden = setWidgetHidden(loose, "activity", true);
    const tight = applyLayoutSpacing(withHidden, "tight", {
      showInbox: true,
      showPulse: true,
    });
    expect(tight.spacing).toBe("tight");
    expect(tight.widgets.find((w) => w.id === "activity")?.hidden).toBe(true);

    const featured = tight.widgets.find((w) => w.id === "featured")!;
    const overview = tight.widgets.find((w) => w.id === "overview")!;
    expect(overview.y - (featured.y + featured.h)).toBe(HOME_SPACING_GAP_PX.tight);
  });

  it("rehomes shown widgets into hierarchy order (not the park zone)", () => {
    const base = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const parked = base.widgets.find((w) => w.id === "upcoming")!;
    expect(parked.hidden).toBe(true);
    expect(parked.y).toBeGreaterThan(1000);

    const shown = setWidgetHidden(base, "upcoming", false);
    const upcoming = shown.widgets.find((w) => w.id === "upcoming")!;
    expect(upcoming.hidden).toBe(false);
    expect(upcoming.y).toBeLessThan(1200);
    expect(upcoming.w).toBe(HOME_CANVAS_DESIGN_WIDTH);

    const featured = shown.widgets.find((w) => w.id === "featured")!;
    const overview = shown.widgets.find((w) => w.id === "overview")!;
    const tasks = shown.widgets.find((w) => w.id === "tasks")!;
    expect(featured.y).toBe(0);
    expect(overview.y).toBeGreaterThan(featured.y);
    expect(tasks.y).toBeGreaterThan(overview.y);
    expect(upcoming.y).toBeGreaterThan(tasks.y);
    expect(layoutHasOverlaps(shown.widgets)).toBe(false);
  });

  it("reflows the stack when hiding a widget so gaps close", () => {
    const base = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const withUpcoming = setWidgetHidden(base, "upcoming", false);
    const withoutFocus = setWidgetHidden(withUpcoming, "overview", true);
    expect(
      withoutFocus.widgets.find((w) => w.id === "overview")?.hidden,
    ).toBe(true);
    const featured = withoutFocus.widgets.find((w) => w.id === "featured")!;
    const tasks = withoutFocus.widgets.find((w) => w.id === "tasks")!;
    const upcoming = withoutFocus.widgets.find((w) => w.id === "upcoming")!;
    expect(featured.y).toBe(0);
    expect(tasks.y).toBeGreaterThan(featured.y);
    expect(upcoming.y).toBeGreaterThan(tasks.y);
    expect(layoutHasOverlaps(withoutFocus.widgets)).toBe(false);
  });

  it("orders briefing widgets in a stable product sequence", () => {
    expect(
      orderVisibleWidgetsForBriefing([
        "actions",
        "featured",
        "upcoming",
        "tasks",
        "overview",
      ]),
    ).toEqual(["featured", "overview", "tasks", "upcoming", "actions"]);
  });

  it("omits board/oversight widgets for general members", () => {
    const state = buildDefaultWorkspace({ showInbox: false, showPulse: false });
    const visible = visibleWorkspaceWidgets(state).map((widget) => widget.id);
    expect(visible).toEqual(["featured", "overview", "tasks"]);
    expect(visible).not.toContain("inbox");
    expect(visible).not.toContain("pulse");
    expect(visible).not.toContain("activity");
    expect(visible).not.toContain("minutes");
    expect(layoutHasOverlaps(state.widgets)).toBe(false);
  });

  it("maps pixel sizes to adaptive density tiers", () => {
    expect(densityForSize(220, 130)).toBe("xs");
    expect(densityForSize(260, 180)).toBe("sm");
    expect(densityForSize(600, 340)).toBe("lg");
    expect(densityForSize(800, 420)).toBe("xl");
  });

  it("fits preview rows to card height (fill tall, shrink short)", () => {
    expect(previewLimitForWidget("lg", "inbox", 140)).toBe(1);
    expect(previewLimitForWidget("lg", "inbox", 190)).toBe(2);
    expect(previewLimitForWidget("lg", "inbox", 210)).toBe(2);
    expect(previewLimitForWidget("xl", "inbox", 500)).toBe(7);
    expect(previewLimitForWidget("xl", "tasks", 700)).toBeGreaterThan(
      previewLimitForWidget("xl", "tasks", 280),
    );
  });

  it("scales featured content down when the card shrinks", () => {
    expect(contentFitScale(780, 220)).toBe(1);
    expect(contentFitScale(320, 160)).toBeLessThan(1);
    expect(contentFitScale(320, 160)).toBeGreaterThanOrEqual(0.68);
  });

  it("cycles widget size presets", () => {
    const base = normalizeWidget({
      id: "inbox",
      x: 0,
      y: 0,
      w: 352,
      h: 490,
    });
    expect(detectSizePreset(base)).toBe("md");
    const next = cycleSizePreset(base);
    expect(detectSizePreset({ id: "inbox", ...next })).toBe("lg");
  });

  it("clamps free drag sizes to widget pixel bounds", () => {
    const overview = normalizeWidget({
      id: "overview",
      x: 0,
      y: 0,
      w: 2000,
      h: 2000,
    });
    expect(overview.w).toBe(HOME_CANVAS_DESIGN_WIDTH);
    expect(overview.h).toBe(640);
  });

  it("allows 1px-precise placement", () => {
    const base = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const next = placeWidgetFree(base, "inbox", { x: 137, y: 241 });
    const inbox = next.widgets.find((w) => w.id === "inbox");
    expect(inbox).toMatchObject({ x: 137, y: 241 });
  });

  it("detects overlaps and packs widgets apart", () => {
    const messy = [
      normalizeWidget({ id: "tasks", x: 0, y: 0, w: 400, h: 300 }),
      normalizeWidget({ id: "inbox", x: 100, y: 50, w: 400, h: 300 }),
    ];
    expect(widgetsOverlap(messy[0]!, messy[1]!)).toBe(true);
    const packed = packWidgets(messy);
    expect(layoutHasOverlaps(packed)).toBe(false);
  });

  it("moves freely even into overlapping space", () => {
    const base = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const next = moveWidget(base, "inbox", 0, 0);
    const inbox = next.widgets.find((w) => w.id === "inbox");
    expect(inbox).toMatchObject({ x: 0, y: 0 });
  });

  it("resizes from edges with pixel precision", () => {
    const origin = normalizeWidget({
      id: "tasks",
      x: 100,
      y: 100,
      w: 300,
      h: 300,
    });
    const se = applyResizeDelta(origin, "se", 17, 23);
    expect(se).toMatchObject({ x: 100, y: 100, w: 317, h: 323 });
    const nw = applyResizeDelta(origin, "nw", 20, 20);
    expect(nw.w).toBe(280);
    expect(nw.h).toBe(280);
    expect(nw.x).toBe(120);
    expect(nw.y).toBe(120);
  });

  it("soft-snaps to the grid only when already close", () => {
    expect(softSnapToGridPx(98, 100, 10)).toBe(100);
    expect(softSnapToGridPx(70, 100, 10)).toBe(70);
  });

  it("resets older saved layouts to the v18 default", () => {
    const merged = mergeWorkspaceWithCatalog(
      { version: 12, widgets: [] },
      { showInbox: true, showPulse: false },
    );
    expect(merged.version).toBe(18);
    expect(visibleWorkspaceWidgets(merged).map((w) => w.id)).toEqual([
      "featured",
      "overview",
      "tasks",
      "activity",
    ]);
  });
});
