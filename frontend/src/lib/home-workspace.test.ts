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

  it("builds a leadership layout with pulse and deadlines", () => {
    const state = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    expect(layoutHasOverlaps(state.widgets)).toBe(false);
    expect(state.spacing).toBe("loose");
    expect(state.version).toBe(8);

    const visible = visibleWorkspaceWidgets(state).map((widget) => widget.id);
    expect(visible).toEqual([
      "featured",
      "overview",
      "minutes",
      "tasks",
      "inbox",
      "pulse",
      "deadlines",
    ]);
    expect(visible).not.toContain("activity");
    expect(visible).not.toContain("upcoming");

    const featured = state.widgets.find((widget) => widget.id === "featured")!;
    const overview = state.widgets.find((widget) => widget.id === "overview")!;
    const minutes = state.widgets.find((widget) => widget.id === "minutes")!;
    const tasks = state.widgets.find((widget) => widget.id === "tasks")!;
    const inbox = state.widgets.find((widget) => widget.id === "inbox")!;
    const pulse = state.widgets.find((widget) => widget.id === "pulse")!;
    expect(tasks.h).toBeGreaterThanOrEqual(400);
    expect(pulse.h).toBeGreaterThanOrEqual(290);
    expect(tasks.w).toBe(featured.w);
    expect(inbox.w).toBe(overview.w);
    expect(minutes.x).toBe(overview.x);
    expect(minutes.y).toBeGreaterThan(overview.y);
  });

  it("builds a board layout without leadership widgets", () => {
    const state = buildDefaultWorkspace({ showInbox: true, showPulse: false });
    const visible = visibleWorkspaceWidgets(state).map((w) => w.id);
    expect(visible).toEqual([
      "featured",
      "overview",
      "minutes",
      "tasks",
      "inbox",
    ]);
    expect(layoutHasOverlaps(state.widgets)).toBe(false);
  });

  it("builds a member layout focused on hero, calendar, and tasks", () => {
    const state = buildDefaultWorkspace({ showInbox: false, showPulse: false });
    const visible = visibleWorkspaceWidgets(state).map((w) => w.id);
    expect(visible).toEqual(["featured", "upcoming", "tasks"]);
    expect(state.widgets.map((w) => w.id)).not.toContain("inbox");
    expect(state.widgets.map((w) => w.id)).not.toContain("overview");
    expect(layoutHasOverlaps(state.widgets)).toBe(false);

    const tasks = state.widgets.find((w) => w.id === "tasks")!;
    expect(tasks.w).toBe(HOME_CANVAS_DESIGN_WIDTH);
  });

  it("stretches short secondary widgets when merging a saved layout", () => {
    const saved = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    saved.widgets = saved.widgets.map((item) =>
      item.id === "deadlines" || item.id === "pulse" || item.id === "minutes"
        ? { ...item, h: 180 }
        : item,
    );
    const merged = mergeWorkspaceWithCatalog(saved, {
      showInbox: true,
      showPulse: true,
    });
    for (const id of ["deadlines", "pulse", "minutes"] as const) {
      expect(
        merged.widgets.find((widget) => widget.id === id)?.h,
      ).toBeGreaterThanOrEqual(260);
    }
    expect(layoutHasOverlaps(merged.widgets)).toBe(false);
  });

  it("does not overlap after merging the default board layout", () => {
    const saved = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const merged = mergeWorkspaceWithCatalog(saved, {
      showInbox: true,
      showPulse: true,
    });
    expect(layoutHasOverlaps(merged.widgets)).toBe(false);
    const minutes = merged.widgets.find((widget) => widget.id === "minutes")!;
    const inbox = merged.widgets.find((widget) => widget.id === "inbox")!;
    const tasks = merged.widgets.find((widget) => widget.id === "tasks")!;
    expect(minutes.y + minutes.h).toBeLessThanOrEqual(inbox.y);
    expect(inbox.y).toBe(tasks.y);
  });

  it("repairs the legacy minutes-stretch collision with inbox", () => {
    const saved = buildDefaultWorkspace({ showInbox: true, showPulse: true });
    const minutes = saved.widgets.find((widget) => widget.id === "minutes")!;
    const inbox = saved.widgets.find((widget) => widget.id === "inbox")!;
    /* Recreate the v7 bug: short minutes that stretch into the inbox slot. */
    saved.widgets = saved.widgets.map((item) => {
      if (item.id === "minutes") {
        return { ...item, h: 160 };
      }
      if (item.id === "inbox") {
        return {
          ...item,
          y: minutes.y + 160 + 28,
          h: inbox.h,
        };
      }
      return item;
    });
    const merged = mergeWorkspaceWithCatalog(saved, {
      showInbox: true,
      showPulse: true,
    });
    expect(layoutHasOverlaps(merged.widgets)).toBe(false);
    const nextMinutes = merged.widgets.find((widget) => widget.id === "minutes")!;
    const nextInbox = merged.widgets.find((widget) => widget.id === "inbox")!;
    expect(nextMinutes.y + nextMinutes.h).toBeLessThanOrEqual(nextInbox.y);
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

    const looseGap = looseOverview.x - (looseFeatured.x + looseFeatured.w);
    const tightGap = tightOverview.x - (tightFeatured.x + tightFeatured.w);
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
    expect(overview.x - (featured.x + featured.w)).toBe(HOME_SPACING_GAP_PX.tight);
  });

  it("omits board/oversight widgets for general members", () => {
    const state = buildDefaultWorkspace({ showInbox: false, showPulse: false });
    const ids = state.widgets.map((widget) => widget.id);
    expect(ids).not.toContain("inbox");
    expect(ids).not.toContain("pulse");
    expect(ids).not.toContain("overview");
    expect(ids).not.toContain("minutes");
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
      w: 600,
      h: 340,
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
    expect(overview.w).toBe(900);
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

  it("resets older saved layouts to the v8 default", () => {
    const merged = mergeWorkspaceWithCatalog(
      { version: 7, widgets: [] },
      { showInbox: true, showPulse: false },
    );
    expect(merged.version).toBe(8);
    expect(visibleWorkspaceWidgets(merged).map((w) => w.id)).toContain(
      "minutes",
    );
  });
});
