/**
 * CampusOS design tokens — single source of truth for color, type, space,
 * radius, and elevation. Values match the current production UI so adopting
 * these tokens does not change appearance.
 */

export const colors = {
  foreground: "#0F172A",
  label: "#64748B",
  primary: {
    DEFAULT: "#0F766E",
    hover: "#0D5F5A",
  },
  accent: {
    DEFAULT: "#0F766E",
    hover: "#0D5F5A",
  },
  mint: "#99F6E4",
  urgent: "#FFFF66",
  overdue: {
    DEFAULT: "#DC2626",
    surface: "#FEF2F2",
  },
  warning: {
    DEFAULT: "#EA580C",
    surface: "#FFF7ED",
  },
  success: {
    DEFAULT: "#16A34A",
    surface: "#F0FDF4",
  },
  border: "#E5E7EB",
  borderMuted: "#F1F5F9",
  surface: {
    DEFAULT: "#F8FAFC",
    card: "#FFFFFF",
    muted: "#F1F5F9",
  },
  kanban: {
    header: "#FAFAFA",
    border: "#E5E7EB",
    badge: "#E5E7EB",
  },
  badge: {
    green: { fg: "#15803D", bg: "#F0FDF4" },
    purple: { fg: "#6D28D9", bg: "#F5F3FF" },
    blue: { fg: "#1D4ED8", bg: "#EFF6FF" },
    teal: { fg: "#0F766E", bg: "#F0FDFA" },
    coral: { fg: "#C2410C", bg: "#FFF7ED" },
    amber: { fg: "#C2410C", bg: "#FFF7ED" },
    red: { fg: "#DC2626", bg: "#FEF2F2" },
  },
  marigold: {
    DEFAULT: "#EA580C",
    hover: "#C2410C",
  },
  olive: {
    DEFAULT: "#16A34A",
    light: "#F0FDF4",
  },
  roleBadge: {
    president: { fg: "#9A6B2E", bg: "#FBF0E3" },
    vicePresident: { fg: "#8B6048", bg: "#F7EDE8" },
    secretary: { fg: "#5C6B7A", bg: "#EDF1F5" },
    treasurer: { fg: "#0F766E", bg: "#F0FDFA" },
    eventManager: { fg: "#6B5494", bg: "#F0ECF7" },
    nsr: { fg: "#15803D", bg: "#F0FDF4" },
    pro: { fg: "#5A6490", bg: "#EEF0F8" },
    board: { fg: "#4A6274", bg: "#EDF1F5" },
    general: { fg: "#64748B", bg: "#F8FAFC" },
  },
} as const;

/** 8-point spacing grid (px). Prefer these multiples in layout. */
export const spacing = {
  0: "0px",
  1: "8px",
  2: "16px",
  3: "24px",
  4: "32px",
  5: "40px",
  6: "48px",
  8: "64px",
} as const;

/** Tailwind-friendly spacing keys mapped to the 8-point grid. */
export const spacingScale = {
  ds0: "0px",
  ds1: "8px",
  ds2: "16px",
  ds3: "24px",
  ds4: "32px",
  ds5: "40px",
  ds6: "48px",
  ds8: "64px",
} as const;

export const radii = {
  sm: "8px",
  md: "10px",
  lg: "12px",
  card: "16px",
  pill: "980px",
  kanban: "10px",
} as const;

export const shadows = {
  card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
  cardHover:
    "0 4px 8px rgba(15, 23, 42, 0.04), 0 12px 24px rgba(15, 23, 42, 0.06)",
} as const;

export const motion = {
  duration: "200ms",
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/**
 * Typography scale (Inter). Sizes in px; weights match current UI hierarchy.
 */
export const typography = {
  fontFamily: {
    sans: [
      "Inter",
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ],
  },
  size: {
    caption: "12px",
    body: "14px",
    bodyLg: "16px",
    title: "18px",
    heading: "24px",
    display: "32px",
    number: "32px",
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
  },
  letterSpacing: {
    headline: "-0.02em",
    subhead: "-0.01em",
    body: "-0.005em",
    label: "0.03em",
  },
} as const;

export const layout = {
  sidebarWidth: "240px",
  mainMaxWidth: "1400px",
} as const;

export type ColorTokens = typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type TypographySize = keyof typeof typography.size;
