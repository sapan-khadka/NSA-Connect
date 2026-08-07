/**
 * Home open canvas workspace — pixel-precise freeform layout.
 * Coordinates are design pixels at HOME_CANVAS_DESIGN_WIDTH; the UI scales to the live canvas.
 */

export const HOME_CANVAS_DESIGN_WIDTH = 1200;
export const HOME_CANVAS_MIN_HEIGHT = 720;
export const HOME_CANVAS_MAX_HEIGHT = 24000;
export const HOME_COLLAPSED_HEIGHT_PX = 52;
/** Default nudge / magnetic threshold in design px */
export const HOME_GUIDE_THRESHOLD_PX = 6;
export const HOME_COARSE_SNAP_PX = 8;

/** Gap between cards (not page margins) in design pixels */
export const HOME_SPACING_GAP_PX = {
  loose: 28,
  tight: 4,
} as const;

export type HomeLayoutSpacing = keyof typeof HOME_SPACING_GAP_PX;

export type WidgetDensity = "xs" | "sm" | "md" | "lg" | "xl";

export type HomeWidgetId =
  | "featured"
  | "overview"
  | "tasks"
  | "inbox"
  | "activity"
  | "actions"
  | "upcoming"
  | "deadlines"
  | "pulse"
  | "minutes";

export type HomeWidgetLayout = {
  id: HomeWidgetId;
  /** Left edge in design pixels */
  x: number;
  /** Top edge in design pixels */
  y: number;
  /** Width in design pixels */
  w: number;
  /** Height in design pixels */
  h: number;
  /** Stacking order (higher = on top) */
  z?: number;
  collapsed?: boolean;
  hidden?: boolean;
};

export type HomeWorkspaceState = {
  version: 18;
  /** Preferred gap when packing / resetting the default layout */
  spacing?: HomeLayoutSpacing;
  widgets: HomeWidgetLayout[];
};

export type HomeWidgetCategory =
  | "Organization"
  | "Communication"
  | "Work";

export type WidgetSizePreset = "sm" | "md" | "lg" | "xl";

export const WIDGET_SIZE_PRESET_LABEL: Record<WidgetSizePreset, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Full width",
};

export const WIDGET_SIZE_PRESET_ORDER: WidgetSizePreset[] = [
  "sm",
  "md",
  "lg",
  "xl",
];

export type HomeWidgetMeta = {
  id: HomeWidgetId;
  label: string;
  description: string;
  category: HomeWidgetCategory;
  requiresBoard?: boolean;
  requiresOversight?: boolean;
  defaultW: number;
  defaultH: number;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
};

export const HOME_WIDGET_CATALOG: HomeWidgetMeta[] = [
  {
    id: "featured",
    label: "Upcoming Event",
    description: "Next event highlight with cover photo",
    category: "Organization",
    defaultW: HOME_CANVAS_DESIGN_WIDTH,
    defaultH: 200,
    minW: 320,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 120,
    maxH: 720,
  },
  {
    id: "overview",
    label: "Today's Focus",
    description: "What deserves your attention right now",
    category: "Organization",
    defaultW: HOME_CANVAS_DESIGN_WIDTH,
    defaultH: 240,
    minW: 220,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 140,
    maxH: 640,
  },
  {
    id: "actions",
    label: "Quick Actions",
    description: "Optional — create entry points already live in + Create",
    category: "Work",
    requiresBoard: true,
    defaultW: HOME_CANVAS_DESIGN_WIDTH,
    defaultH: 260,
    minW: 200,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 140,
    maxH: 480,
  },
  {
    id: "minutes",
    label: "Meetings",
    description: "Board meeting notes and minutes",
    category: "Organization",
    requiresBoard: true,
    defaultW: HOME_CANVAS_DESIGN_WIDTH,
    defaultH: 280,
    minW: 220,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 160,
    maxH: 640,
  },
  {
    id: "tasks",
    label: "My Tasks",
    description: "Your overdue, today, and upcoming work",
    category: "Work",
    defaultW: 586,
    defaultH: 300,
    minW: 200,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 160,
    maxH: 1200,
  },
  {
    id: "inbox",
    label: "Inbox",
    description: "Global chrome — not a dashboard widget",
    category: "Communication",
    requiresBoard: true,
    defaultW: 352,
    defaultH: 490,
    minW: 260,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 180,
    maxH: 1600,
  },
  {
    id: "activity",
    label: "Recent Activity",
    description: "Org signal for board — what just happened",
    category: "Organization",
    requiresBoard: true,
    defaultW: 586,
    defaultH: 300,
    minW: 200,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 160,
    maxH: 1200,
  },
  {
    id: "pulse",
    label: "Organization Health",
    description: "Optional executive snapshot",
    category: "Organization",
    requiresOversight: true,
    defaultW: HOME_CANVAS_DESIGN_WIDTH,
    defaultH: 260,
    minW: 240,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 160,
    maxH: 640,
  },
  {
    id: "upcoming",
    label: "Upcoming Events",
    description: "More events beyond the featured highlight",
    category: "Work",
    defaultW: HOME_CANVAS_DESIGN_WIDTH,
    defaultH: 280,
    minW: 240,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 180,
    maxH: 900,
  },
  {
    id: "deadlines",
    label: "Team Deadlines",
    description: "Open assignments by member across the chapter",
    category: "Work",
    requiresOversight: true,
    defaultW: HOME_CANVAS_DESIGN_WIDTH,
    defaultH: 420,
    minW: 200,
    maxW: HOME_CANVAS_DESIGN_WIDTH,
    minH: 180,
    maxH: 1200,
  },
];

/** 12-col snap unit in design pixels */
export const HOME_GRID_COL_PX = HOME_CANVAS_DESIGN_WIDTH / 12;
export const HOME_GRID_ROW_PX = 40;

export function snapToGridPx(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

/** Attract to the grid only when already close — keeps freeform resize smooth. */
export function softSnapToGridPx(
  value: number,
  unit: number,
  threshold = 10,
): number {
  const snapped = snapToGridPx(value, unit);
  return Math.abs(snapped - value) <= threshold
    ? snapped
    : Math.round(value);
}

const CATALOG_BY_ID = Object.fromEntries(
  HOME_WIDGET_CATALOG.map((item) => [item.id, item]),
) as Record<HomeWidgetId, HomeWidgetMeta>;

export function getHomeWidgetMeta(id: HomeWidgetId): HomeWidgetMeta {
  return CATALOG_BY_ID[id];
}

export const HOME_WIDGET_CATEGORY_ORDER: HomeWidgetCategory[] = [
  "Organization",
  "Communication",
  "Work",
];

export function sizePresetsForWidget(
  id: HomeWidgetId,
): Record<WidgetSizePreset, { w: number; h: number }> {
  const meta = CATALOG_BY_ID[id];
  const full = HOME_CANVAS_DESIGN_WIDTH;
  return {
    sm: {
      w: clamp(Math.round(meta.defaultW * 0.72), meta.minW, meta.maxW),
      h: clamp(Math.round(meta.defaultH * 0.78), meta.minH, meta.maxH),
    },
    md: { w: meta.defaultW, h: meta.defaultH },
    lg: {
      w: clamp(Math.round(meta.defaultW * 1.2), meta.minW, meta.maxW),
      h: clamp(Math.round(meta.defaultH * 1.25), meta.minH, meta.maxH),
    },
    xl: {
      w: clamp(full, meta.minW, meta.maxW),
      h: clamp(Math.round(meta.defaultH * 1.45), meta.minH, meta.maxH),
    },
  };
}

export function detectSizePreset(
  widget: Pick<HomeWidgetLayout, "id" | "w" | "h">,
): WidgetSizePreset {
  const presets = sizePresetsForWidget(widget.id);
  let best: WidgetSizePreset = "md";
  let bestScore = Number.POSITIVE_INFINITY;
  for (const key of WIDGET_SIZE_PRESET_ORDER) {
    const preset = presets[key];
    const score =
      Math.abs(preset.w - widget.w) + Math.abs(preset.h - widget.h);
    if (score < bestScore) {
      bestScore = score;
      best = key;
    }
  }
  return best;
}

export function cycleSizePreset(
  widget: HomeWidgetLayout,
): Pick<HomeWidgetLayout, "w" | "h"> {
  const current = detectSizePreset(widget);
  const index = WIDGET_SIZE_PRESET_ORDER.indexOf(current);
  const next =
    WIDGET_SIZE_PRESET_ORDER[(index + 1) % WIDGET_SIZE_PRESET_ORDER.length]!;
  return sizePresetsForWidget(widget.id)[next];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to nearest integer pixel (sub-pixel input allowed during drag). */
export function roundPx(value: number): number {
  return Math.round(value);
}

export function snapPx(value: number, step: number): number {
  if (step <= 1) {
    return roundPx(value);
  }
  return Math.round(value / step) * step;
}

export function effectiveHeight(widget: HomeWidgetLayout): number {
  return widget.collapsed ? HOME_COLLAPSED_HEIGHT_PX : widget.h;
}

export function normalizeWidget(widget: HomeWidgetLayout): HomeWidgetLayout {
  const meta = CATALOG_BY_ID[widget.id];
  if (!meta) {
    return widget;
  }
  const w = clamp(roundPx(widget.w), meta.minW, meta.maxW);
  const h = widget.collapsed
    ? HOME_COLLAPSED_HEIGHT_PX
    : clamp(roundPx(widget.h), meta.minH, meta.maxH);
  const x = clamp(roundPx(widget.x), 0, HOME_CANVAS_DESIGN_WIDTH - w);
  const y = clamp(roundPx(widget.y), 0, HOME_CANVAS_MAX_HEIGHT - h);
  const z = widget.z ?? 1;
  return { ...widget, x, y, w, h, z };
}

/**
 * Density from live screen (or design) width/height.
 * Short or narrow cards step down so content can reflow instead of clipping.
 */
export function densityForSize(w: number, h: number): WidgetDensity {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const area = width * height;

  if (width <= 240 || height <= 140 || area <= 42_000) {
    return "xs";
  }
  if (width <= 320 || height <= 180 || area <= 70_000) {
    return "sm";
  }
  if (width <= 440 || height <= 240 || area <= 130_000) {
    return "md";
  }
  if (width <= 640 || height <= 320 || area <= 240_000) {
    return "lg";
  }
  return "xl";
}

/** @deprecated Prefer densityForSize — kept for older call sites. */
export function densityForSpan(w: number, h: number): WidgetDensity {
  /* Heuristic: grid-era callers passed col/row spans; pixel callers pass px. */
  if (w <= 12 && h <= 12) {
    return densityForSize(w * 100, h * 110);
  }
  return densityForSize(w, h);
}

export type PreviewKind = "inbox" | "activity" | "events" | "deadlines" | "tasks";

/** Approximate row + chrome heights used to fill list widgets to their card. */
const PREVIEW_ROW_PX: Record<PreviewKind, number> = {
  inbox: 58,
  activity: 52,
  events: 56,
  deadlines: 52,
  tasks: 58,
};

const PREVIEW_CHROME_PX: Record<PreviewKind, number> = {
  inbox: 72,
  activity: 64,
  events: 64,
  deadlines: 56,
  tasks: 96,
};

const PREVIEW_MAX: Record<PreviewKind, number> = {
  inbox: 14,
  activity: 16,
  events: 14,
  deadlines: 16,
  tasks: 14,
};

export function previewLimitForDensity(
  density: WidgetDensity,
  kind: PreviewKind,
): number {
  const table: Record<PreviewKind, Record<WidgetDensity, number>> = {
    inbox: { xs: 1, sm: 2, md: 4, lg: 7, xl: 10 },
    activity: { xs: 1, sm: 2, md: 4, lg: 7, xl: 12 },
    events: { xs: 1, sm: 2, md: 4, lg: 5, xl: 8 },
    deadlines: { xs: 2, sm: 3, md: 5, lg: 7, xl: 10 },
    tasks: { xs: 1, sm: 2, md: 4, lg: 6, xl: 10 },
  };
  return table[kind][density];
}

/**
 * How many list rows fit in the live card height.
 * Grows when the card is taller; shrinks when shorter — fills the card.
 */
export function previewLimitForWidget(
  density: WidgetDensity,
  kind: PreviewKind,
  screenHeightPx: number,
): number {
  const fitted = Math.floor(
    (Math.max(0, screenHeightPx) - PREVIEW_CHROME_PX[kind]) /
      PREVIEW_ROW_PX[kind],
  );
  if (fitted >= 1) {
    return clamp(fitted, 1, PREVIEW_MAX[kind]);
  }
  return clamp(previewLimitForDensity(density, kind), 1, PREVIEW_MAX[kind]);
}

/**
 * Continuous 0.68–1 scale for typography/spacing inside a card.
 * Used so featured CTAs stay readable instead of clipping.
 */
export function contentFitScale(widthPx: number, heightPx: number): number {
  const sw = clamp(widthPx / 560, 0.68, 1);
  const sh = clamp(heightPx / 210, 0.68, 1);
  return Math.round(Math.min(sw, sh) * 100) / 100;
}

function widget(
  id: HomeWidgetId,
  x: number,
  y: number,
  w: number,
  h: number,
  z = 1,
  extras: Partial<Pick<HomeWidgetLayout, "hidden" | "collapsed">> = {},
): HomeWidgetLayout {
  return normalizeWidget({ id, x, y, w, h, z, ...extras });
}

export function normalizeSpacing(
  spacing: HomeLayoutSpacing | string | undefined | null,
): HomeLayoutSpacing {
  return spacing === "tight" ? "tight" : "loose";
}

export function spacingGapPx(spacing: HomeLayoutSpacing | undefined): number {
  return HOME_SPACING_GAP_PX[normalizeSpacing(spacing)];
}

/**
 * Immediately reflow the recommended packed layout so only the gaps *between*
 * cards change (tight vs loose). Preserves hide/collapse choices.
 */
export function applyLayoutSpacing(
  state: HomeWorkspaceState,
  spacing: HomeLayoutSpacing,
  opts: { showInbox: boolean; showPulse: boolean },
): HomeWorkspaceState {
  const nextSpacing = normalizeSpacing(spacing);
  const packed = buildDefaultWorkspace({
    showInbox: opts.showInbox,
    showPulse: opts.showPulse,
    spacing: nextSpacing,
  });
  const prevById = new Map(state.widgets.map((item) => [item.id, item]));
  const widgets = packed.widgets.map((item) => {
    const prev = prevById.get(item.id);
    if (!prev) {
      return item;
    }
    return normalizeWidget({
      ...item,
      hidden: prev.hidden,
      collapsed: prev.collapsed,
    });
  });

  for (const prev of state.widgets) {
    if (!widgets.some((item) => item.id === prev.id)) {
      widgets.push(prev);
    }
  }

  return {
    version: 18,
    spacing: nextSpacing,
    widgets: dedupeWidgets(widgets),
  };
}

/**
 * Widgets rendered outside the freeform canvas (fixed chrome).
 * Inbox is a sticky right rail for board+ — not a movable card.
 */
export const HOME_PINNED_RAIL_WIDGETS: ReadonlySet<HomeWidgetId> = new Set([
  "inbox",
]);

export function isPinnedRailWidget(id: HomeWidgetId): boolean {
  return HOME_PINNED_RAIL_WIDGETS.has(id);
}

function parkHidden(
  id: HomeWidgetId,
  index: number,
): HomeWidgetLayout {
  const meta = CATALOG_BY_ID[id];
  return widget(id, 0, 2400 + index * 120, meta.defaultW, meta.defaultH, 0, {
    hidden: true,
  });
}

/**
 * Role-aware recommended layouts (workspace widgets only).
 * Inbox is global app chrome — never a canvas card.
 *
 * Briefing Home: Event banner → Today's Focus → Tasks | Activity
 * same structure for board and general members (board adds Activity).
 * Organization Health stays parked.
 */
export function buildDefaultWorkspace(opts: {
  showInbox: boolean;
  showPulse: boolean;
  spacing?: HomeLayoutSpacing;
}): HomeWorkspaceState {
  const spacing = normalizeSpacing(opts.spacing);
  const gap = spacingGapPx(spacing);
  const full = HOME_CANVAS_DESIGN_WIDTH;

  const eventH = 200;
  const focusH = 220;
  const eventY = 0;
  const focusY = eventH + gap;
  const workY = focusY + focusH + gap;
  const workH = 300;
  const park = (ids: HomeWidgetId[]) =>
    ids.map((id, index) => parkHidden(id, index));

  /* General members: Event banner + Focus + full-width My Tasks. */
  if (!opts.showInbox) {
    return {
      version: 18,
      spacing,
      widgets: dedupeWidgets([
        widget("featured", 0, eventY, full, eventH, 1),
        widget("overview", 0, focusY, full, focusH, 2),
        widget("tasks", 0, workY, full, workH, 3),
        ...park([
          "activity",
          "upcoming",
          "inbox",
          "actions",
          "deadlines",
          "pulse",
          "minutes",
        ]),
      ]),
    };
  }

  /*
   * Board / leadership briefing
   * ┌─────────── Event banner ──────────────┐
   * ├─────────── Today's Focus ─────────────┤
   * ├────── My Tasks ───┬── Activity ───────┤
   */
  const colW = Math.floor((full - gap) / 2);
  const activityH = Math.round(workH * 0.85);

  return {
    version: 18,
    spacing,
    widgets: dedupeWidgets([
      widget("featured", 0, eventY, full, eventH, 1),
      widget("overview", 0, focusY, full, focusH, 2),
      widget("tasks", 0, workY, colW, workH, 3),
      widget("activity", colW + gap, workY, full - colW - gap, activityH, 3),
      ...park([
        "upcoming",
        "inbox",
        "actions",
        "deadlines",
        "pulse",
        "minutes",
      ]),
    ]),
  };
}

function dedupeWidgets(widgets: HomeWidgetLayout[]): HomeWidgetLayout[] {
  const seen = new Set<HomeWidgetId>();
  const next: HomeWidgetLayout[] = [];
  for (const item of widgets) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    next.push(normalizeWidget(item));
  }
  return next;
}

export function widgetsOverlap(
  a: HomeWidgetLayout,
  b: HomeWidgetLayout,
): boolean {
  if (a.hidden || b.hidden || a.id === b.id) {
    return false;
  }
  const ah = effectiveHeight(a);
  const bh = effectiveHeight(b);
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + bh &&
    a.y + ah > b.y
  );
}

export function layoutHasOverlaps(widgets: HomeWidgetLayout[]): boolean {
  for (let i = 0; i < widgets.length; i += 1) {
    for (let j = i + 1; j < widgets.length; j += 1) {
      if (widgetsOverlap(widgets[i]!, widgets[j]!)) {
        return true;
      }
    }
  }
  return false;
}

export function findFreeSlot(
  widget: HomeWidgetLayout,
  others: HomeWidgetLayout[],
): { x: number; y: number } {
  const h = effectiveHeight(widget);
  const step = 10;
  for (let y = 0; y <= HOME_CANVAS_MAX_HEIGHT - h; y += step) {
    for (let x = 0; x <= HOME_CANVAS_DESIGN_WIDTH - widget.w; x += step) {
      const candidate = normalizeWidget({ ...widget, x, y });
      if (!others.some((other) => widgetsOverlap(candidate, other))) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }
  return { x: 0, y: canvasHeight(others) };
}

/** Pack widgets top-to-bottom / left-to-right with zero overlaps. */
export function packWidgets(widgets: HomeWidgetLayout[]): HomeWidgetLayout[] {
  const ordered = [...widgets].sort((a, b) => {
    if (a.hidden !== b.hidden) {
      return a.hidden ? 1 : -1;
    }
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    if (a.x !== b.x) {
      return a.x - b.x;
    }
    return a.id.localeCompare(b.id);
  });
  const placed: HomeWidgetLayout[] = [];
  for (const item of ordered) {
    if (item.hidden) {
      placed.push(item);
      continue;
    }
    const slot = findFreeSlot(item, placed);
    placed.push(normalizeWidget({ ...item, x: slot.x, y: slot.y }));
  }
  return placed;
}

export function placeWidget(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  next: Partial<Pick<HomeWidgetLayout, "x" | "y" | "w" | "h" | "z">>,
  opts: { avoidOverlap?: boolean } = {},
): HomeWorkspaceState {
  const current = state.widgets.find((item) => item.id === id);
  if (!current) {
    return state;
  }
  const maxZ = Math.max(1, ...state.widgets.map((item) => item.z ?? 1));
  let candidate = normalizeWidget({
    ...current,
    ...next,
    z: next.z ?? maxZ + 1,
  });
  const others = state.widgets.filter((item) => item.id !== id);
  if (opts.avoidOverlap && others.some((other) => widgetsOverlap(candidate, other))) {
    const slot = findFreeSlot(candidate, others);
    candidate = normalizeWidget({ ...candidate, x: slot.x, y: slot.y });
  }
  return {
    version: 18,
    spacing: normalizeSpacing(state.spacing),
    widgets: state.widgets.map((item) => (item.id === id ? candidate : item)),
  };
}

/** Freeform place (allows overlap). Prefer this for precise canvas edits. */
export function placeWidgetFree(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  next: Partial<Pick<HomeWidgetLayout, "x" | "y" | "w" | "h" | "z">>,
): HomeWorkspaceState {
  return placeWidget(state, id, next, { avoidOverlap: false });
}

/** @deprecated alias — freeform by default in v4 */
export function placeWidgetWithoutOverlap(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  next: Partial<Pick<HomeWidgetLayout, "x" | "y" | "w" | "h">>,
): HomeWorkspaceState {
  return placeWidget(state, id, next, { avoidOverlap: false });
}

export type AlignmentGuide = {
  orientation: "x" | "y";
  /** Design-pixel position of the guide line */
  at: number;
};

export type SnapResult = {
  x: number;
  y: number;
  w: number;
  h: number;
  guides: AlignmentGuide[];
};

/**
 * Magnetically snap a rect's edges to other widgets / canvas center / edges.
 * Precision: 1px base; pass snapStep > 1 for coarse grid (e.g. Shift → 8px).
 */
export function snapRectToGuides(
  rect: { x: number; y: number; w: number; h: number },
  others: HomeWidgetLayout[],
  opts: {
    threshold?: number;
    snapStep?: number;
    canvasWidth?: number;
  } = {},
): SnapResult {
  const threshold = opts.threshold ?? HOME_GUIDE_THRESHOLD_PX;
  const snapStep = opts.snapStep ?? 1;
  const canvasWidth = opts.canvasWidth ?? HOME_CANVAS_DESIGN_WIDTH;

  let { x, y, w, h } = rect;
  x = snapPx(x, snapStep);
  y = snapPx(y, snapStep);
  w = snapPx(w, snapStep);
  h = snapPx(h, snapStep);

  const targetsX: number[] = [0, canvasWidth / 2, canvasWidth];
  const targetsY: number[] = [0];
  for (const other of others) {
    if (other.hidden) {
      continue;
    }
    const oh = effectiveHeight(other);
    targetsX.push(other.x, other.x + other.w / 2, other.x + other.w);
    targetsY.push(other.y, other.y + oh / 2, other.y + oh);
  }

  const edgesX = [
    { key: "left" as const, value: x },
    { key: "center" as const, value: x + w / 2 },
    { key: "right" as const, value: x + w },
  ];
  const edgesY = [
    { key: "top" as const, value: y },
    { key: "middle" as const, value: y + h / 2 },
    { key: "bottom" as const, value: y + h },
  ];

  const guides: AlignmentGuide[] = [];
  let bestDx = threshold + 1;
  let bestDy = threshold + 1;
  let snapDx = 0;
  let snapDy = 0;
  let guideX: number | null = null;
  let guideY: number | null = null;

  for (const edge of edgesX) {
    for (const target of targetsX) {
      const d = target - edge.value;
      const ad = Math.abs(d);
      if (ad <= threshold && ad < bestDx) {
        bestDx = ad;
        snapDx = d;
        guideX = target;
      }
    }
  }
  for (const edge of edgesY) {
    for (const target of targetsY) {
      const d = target - edge.value;
      const ad = Math.abs(d);
      if (ad <= threshold && ad < bestDy) {
        bestDy = ad;
        snapDy = d;
        guideY = target;
      }
    }
  }

  if (guideX !== null) {
    x += snapDx;
    guides.push({ orientation: "x", at: guideX });
  }
  if (guideY !== null) {
    y += snapDy;
    guides.push({ orientation: "y", at: guideY });
  }

  return {
    x: roundPx(x),
    y: roundPx(y),
    w: roundPx(w),
    h: roundPx(h),
    guides,
  };
}

export type ResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

export function applyResizeDelta(
  origin: HomeWidgetLayout,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
): Pick<HomeWidgetLayout, "x" | "y" | "w" | "h"> {
  const meta = CATALOG_BY_ID[origin.id];
  let { x, y, w, h } = origin;
  const right = x + w;
  const bottom = y + h;

  if (handle.includes("e")) {
    w = clamp(origin.w + deltaX, meta.minW, meta.maxW);
  }
  if (handle.includes("s")) {
    h = clamp(origin.h + deltaY, meta.minH, meta.maxH);
  }
  if (handle.includes("w")) {
    const nextW = clamp(origin.w - deltaX, meta.minW, meta.maxW);
    x = right - nextW;
    w = nextW;
  }
  if (handle.includes("n")) {
    const nextH = clamp(origin.h - deltaY, meta.minH, meta.maxH);
    y = bottom - nextH;
    h = nextH;
  }

  x = clamp(x, 0, HOME_CANVAS_DESIGN_WIDTH - w);
  y = clamp(y, 0, HOME_CANVAS_MAX_HEIGHT - h);
  return { x: roundPx(x), y: roundPx(y), w: roundPx(w), h: roundPx(h) };
}

/** Only stretch stubby secondary cards; keep asymmetric heights intact. */
export const HOME_SECONDARY_MIN_H = 260;

const SECONDARY_WIDGET_IDS = new Set<HomeWidgetId>([
  "upcoming",
  "deadlines",
  "pulse",
  "minutes",
]);

/**
 * Stretch short Upcoming / Deadlines / Pulse / Meetings cards up to the
 * recommended height so saved layouts pick up more list rows without a full
 * reset. Callers must resolve overlaps afterward — growing in place can
 * collide with widgets packed below.
 */
export function ensureSecondaryWidgetHeights(
  widgets: HomeWidgetLayout[],
  minH = HOME_SECONDARY_MIN_H,
): HomeWidgetLayout[] {
  return widgets.map((item) => {
    if (!SECONDARY_WIDGET_IDS.has(item.id) || item.hidden || item.collapsed) {
      return item;
    }
    if (item.h >= minH) {
      return item;
    }
    return normalizeWidget({ ...item, h: minH });
  });
}

/** If stretch/custom edits left overlaps, fall back to a packed layout. */
export function repairOverlappingWidgets(
  widgets: HomeWidgetLayout[],
): HomeWidgetLayout[] {
  if (!layoutHasOverlaps(widgets)) {
    return widgets;
  }
  return packWidgets(widgets);
}

export function mergeWorkspaceWithCatalog(
  saved: HomeWorkspaceState | { version?: number; widgets?: unknown } | null,
  opts: {
    showInbox: boolean;
    showPulse: boolean;
    spacing?: HomeLayoutSpacing;
  },
): HomeWorkspaceState {
  const spacing = normalizeSpacing(
    opts.spacing ?? (saved as HomeWorkspaceState | null)?.spacing,
  );
  const base = buildDefaultWorkspace({ ...opts, spacing });
  /* Only current pixel layouts are trusted; older saves reset cleanly. */
  if (!saved || (saved as HomeWorkspaceState).version !== 18) {
    return base;
  }

  const byId = new Map(
    (saved as HomeWorkspaceState).widgets.map((item) => [item.id, item]),
  );
  const merged: HomeWidgetLayout[] = [];

  for (const item of (saved as HomeWorkspaceState).widgets) {
    const meta = CATALOG_BY_ID[item.id];
    if (!meta) {
      continue;
    }
    if (meta.requiresBoard && !opts.showInbox) {
      continue;
    }
    if (meta.requiresOversight && !opts.showPulse) {
      continue;
    }
    merged.push(normalizeWidget(item));
  }

  for (const fallback of base.widgets) {
    if (!byId.has(fallback.id) && !merged.some((item) => item.id === fallback.id)) {
      merged.push(fallback);
    }
  }

  const widgets = repairOverlappingWidgets(
    ensureSecondaryWidgetHeights(dedupeWidgets(merged)),
  );

  /* Stretch-without-reflow corruption is common; prefer the default grid. */
  if (layoutHasOverlaps(widgets)) {
    return base;
  }

  return {
    version: 18,
    spacing,
    widgets,
  };
}

export function visibleWorkspaceWidgets(
  state: HomeWorkspaceState,
): HomeWidgetLayout[] {
  return state.widgets.filter(
    (item) => !item.hidden && !isPinnedRailWidget(item.id),
  );
}

export function canvasHeight(widgets: HomeWidgetLayout[]): number {
  let max = HOME_CANVAS_MIN_HEIGHT;
  for (const item of widgets) {
    if (item.hidden) {
      continue;
    }
    max = Math.max(max, item.y + effectiveHeight(item) + 80);
  }
  return clamp(max, HOME_CANVAS_MIN_HEIGHT, HOME_CANVAS_MAX_HEIGHT);
}

/**
 * Place a newly shown widget (legacy helper — prefer reflowWorkspaceLayout).
 * Appends full-width under the stack as a soft fallback.
 */
export function placeShownWidget(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
): Pick<HomeWidgetLayout, "x" | "y" | "w" | "h" | "z"> {
  const meta = CATALOG_BY_ID[id];
  const gap = spacingGapPx(state.spacing);
  const others = state.widgets.filter(
    (item) => item.id !== id && !item.hidden && !isPinnedRailWidget(item.id),
  );

  let bottom = 0;
  for (const item of others) {
    bottom = Math.max(bottom, item.y + effectiveHeight(item));
  }
  const y = others.length === 0 ? 0 : bottom + gap;
  const w = HOME_CANVAS_DESIGN_WIDTH;
  const h = Math.max(meta.defaultH, meta.minH);
  const z =
    Math.max(0, ...state.widgets.map((item) => item.z ?? 1)) + 1;

  return {
    x: 0,
    y: clamp(y, 0, HOME_CANVAS_MAX_HEIGHT - h),
    w,
    h,
    z,
  };
}

/**
 * Document-order packing for the edit canvas.
 * Keeps primary stack coherent when showing/hiding widgets:
 *   Featured → Focus → Tasks | Activity → secondary full-width rows
 */
export function reflowWorkspaceLayout(
  state: HomeWorkspaceState,
): HomeWorkspaceState {
  const spacing = normalizeSpacing(state.spacing);
  const gap = spacingGapPx(spacing);
  const full = HOME_CANVAS_DESIGN_WIDTH;
  const byId = new Map(state.widgets.map((item) => [item.id, item]));

  const visibleIds = orderVisibleWidgetsForBriefing(
    state.widgets
      .filter((item) => !item.hidden && !isPinnedRailWidget(item.id))
      .map((item) => item.id),
  );

  for (const item of state.widgets) {
    if (
      !item.hidden &&
      !isPinnedRailWidget(item.id) &&
      !visibleIds.includes(item.id)
    ) {
      visibleIds.push(item.id);
    }
  }

  const laid: HomeWidgetLayout[] = [];
  const placed = new Set<HomeWidgetId>();
  let y = 0;
  let z = 1;

  function pushVisible(
    id: HomeWidgetId,
    x: number,
    rowY: number,
    w: number,
    h: number,
  ) {
    const prev = byId.get(id);
    const collapsed = Boolean(prev?.collapsed);
    laid.push(
      normalizeWidget({
        id,
        x,
        y: rowY,
        w,
        h: collapsed ? HOME_COLLAPSED_HEIGHT_PX : h,
        z: z++,
        collapsed,
        hidden: false,
      }),
    );
    placed.add(id);
  }

  for (const id of visibleIds) {
    if (placed.has(id)) {
      continue;
    }

    const meta = CATALOG_BY_ID[id];
    if (!meta) {
      continue;
    }

    /* Work row: My Tasks + Recent Activity side by side when both shown. */
    if (
      id === "tasks" &&
      visibleIds.includes("activity") &&
      !placed.has("activity")
    ) {
      const colW = Math.floor((full - gap) / 2);
      const tasksPrev = byId.get("tasks");
      const actPrev = byId.get("activity");
      const tasksCollapsed = Boolean(tasksPrev?.collapsed);
      const actCollapsed = Boolean(actPrev?.collapsed);
      const hTasks = tasksCollapsed
        ? HOME_COLLAPSED_HEIGHT_PX
        : Math.max(CATALOG_BY_ID.tasks.defaultH, 280);
      const hAct = actCollapsed
        ? HOME_COLLAPSED_HEIGHT_PX
        : Math.max(CATALOG_BY_ID.activity.defaultH, 260);
      const rowH = Math.max(hTasks, hAct);
      pushVisible("tasks", 0, y, colW, rowH);
      pushVisible("activity", colW + gap, y, full - colW - gap, rowH);
      y += rowH + gap;
      continue;
    }

    if (id === "activity" && placed.has("activity")) {
      continue;
    }

    /* Everything else is full-bleed under the stack. */
    const h = Math.max(meta.defaultH, meta.minH);
    pushVisible(id, 0, y, full, h);
    const laidItem = laid[laid.length - 1]!;
    y += effectiveHeight(laidItem) + gap;
  }

  /* Park hidden canvas widgets off-screen. */
  let parkIndex = 0;
  for (const item of state.widgets) {
    if (placed.has(item.id)) {
      continue;
    }
    if (isPinnedRailWidget(item.id)) {
      laid.push(
        normalizeWidget({
          ...item,
          ...parkHidden(item.id, parkIndex++),
          hidden: true,
          collapsed: item.collapsed,
        }),
      );
      continue;
    }
    if (item.hidden) {
      laid.push(
        normalizeWidget({
          ...item,
          ...parkHidden(item.id, parkIndex++),
          hidden: true,
          collapsed: item.collapsed,
        }),
      );
    }
  }

  return {
    version: 18,
    spacing,
    widgets: dedupeWidgets(laid),
  };
}

export function setWidgetHidden(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  hidden: boolean,
): HomeWorkspaceState {
  const spacing = normalizeSpacing(state.spacing);
  const exists = state.widgets.some((item) => item.id === id);

  if (!exists) {
    if (hidden) {
      return state;
    }
    const meta = CATALOG_BY_ID[id];
    if (!meta) {
      return state;
    }
    const next: HomeWorkspaceState = {
      version: 18,
      spacing,
      widgets: [
        ...state.widgets,
        normalizeWidget({
          id,
          x: 0,
          y: 0,
          w: meta.defaultW,
          h: meta.defaultH,
          hidden: false,
          collapsed: false,
          z: 1,
        }),
      ],
    };
    return reflowWorkspaceLayout(next);
  }

  const nextWidgets = state.widgets.map((item) =>
    item.id === id
      ? {
          ...item,
          hidden,
          collapsed: hidden ? item.collapsed : false,
        }
      : item,
  );

  return reflowWorkspaceLayout({
    version: 18,
    spacing,
    widgets: nextWidgets,
  });
}

/**
 * Stable document order for reading Home (and edit reflow).
 * Only ids that are currently visible should be passed in.
 */
export const BRIEFING_WIDGET_ORDER: readonly HomeWidgetId[] = [
  "featured",
  "overview",
  "tasks",
  "activity",
  "upcoming",
  "deadlines",
  "minutes",
  "actions",
  "pulse",
] as const;

export function orderVisibleWidgetsForBriefing(
  visibleIds: Iterable<HomeWidgetId>,
): HomeWidgetId[] {
  const present = new Set(visibleIds);
  return BRIEFING_WIDGET_ORDER.filter((id) => present.has(id));
}

export function setWidgetCollapsed(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  collapsed: boolean,
): HomeWorkspaceState {
  return {
    version: 18,
    spacing: normalizeSpacing(state.spacing),
    widgets: state.widgets.map((item) =>
      item.id === id ? normalizeWidget({ ...item, collapsed }) : item,
    ),
  };
}

export function moveWidget(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  x: number,
  y: number,
): HomeWorkspaceState {
  return placeWidgetFree(state, id, { x, y });
}

export function resizeWidget(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  next: { w?: number; h?: number; x?: number; y?: number },
): HomeWorkspaceState {
  return placeWidgetFree(state, id, next);
}

export function nudgeWidget(
  state: HomeWorkspaceState,
  id: HomeWidgetId,
  dx: number,
  dy: number,
): HomeWorkspaceState {
  const current = state.widgets.find((item) => item.id === id);
  if (!current) {
    return state;
  }
  return placeWidgetFree(state, id, {
    x: current.x + dx,
    y: current.y + dy,
  });
}

export type ScaleMetrics = {
  scale: number;
  canvasWidth: number;
  /** Centers the design board when the live canvas is wider than max scale. */
  offsetX: number;
};

/** Don’t inflate cards past this — ultrawide / zoom-out would leave empty card chrome. */
export const HOME_CANVAS_MAX_SCALE = 1.15;

export function measureScale(canvasWidth: number): ScaleMetrics {
  const width = Math.max(1, canvasWidth);
  const raw = width / HOME_CANVAS_DESIGN_WIDTH;
  const scale = clamp(raw, 0.4, HOME_CANVAS_MAX_SCALE);
  const boardWidth = HOME_CANVAS_DESIGN_WIDTH * scale;
  const offsetX = Math.max(0, Math.round((width - boardWidth) / 2));
  return {
    canvasWidth: width,
    scale,
    offsetX,
  };
}

export function designToScreen(
  value: number,
  scale: number,
): number {
  return value * scale;
}

export function screenToDesign(
  value: number,
  scale: number,
): number {
  return value / Math.max(scale, 0.0001);
}

export function rectForWidget(
  widget: Pick<HomeWidgetLayout, "x" | "y" | "w" | "h" | "collapsed">,
  scale: number,
  offsetX = 0,
): { left: number; top: number; width: number; height: number } {
  return {
    left: designToScreen(widget.x, scale) + offsetX,
    top: designToScreen(widget.y, scale),
    width: designToScreen(widget.w, scale),
    height: designToScreen(effectiveHeight(widget as HomeWidgetLayout), scale),
  };
}

export function homeWorkspaceStorageKey(memberId: number): string {
  return `nsa_home_workspace_v18:${memberId}`;
}

export function loadHomeWorkspace(
  memberId: number,
): HomeWorkspaceState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(homeWorkspaceStorageKey(memberId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as HomeWorkspaceState;
  } catch {
    return null;
  }
}

export function saveHomeWorkspace(
  memberId: number,
  state: HomeWorkspaceState,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      homeWorkspaceStorageKey(memberId),
      JSON.stringify(state),
    );
  } catch {
    /* ignore */
  }
}
