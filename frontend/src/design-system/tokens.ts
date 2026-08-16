/**
 * NSA Connect design tokens.
 * Brand red is for actions and selected states. Near-black is for type only.
 * Semantic badges, roles, and status hues stay distinct from brand.
 * Keep values in sync with tokens.css.
 */

export const colors = {
  foreground: "#111111",
  label: "#5F6368",
  brand: {
    DEFAULT: "#C8102E",
    hover: "#A80D27",
    soft: "#FFF1F3",
    muted: "#FFE3E7",
  },
  primary: {
    DEFAULT: "#C8102E",
    hover: "#A80D27",
  },
  accent: {
    DEFAULT: "#C8102E",
    hover: "#A80D27",
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
  border: "#E7E7E8",
  borderMuted: "#EEEEEF",
  surface: {
    DEFAULT: "#FAFAFA",
    card: "#FFFFFF",
    muted: "#F7F7F8",
  },
  kanban: {
    header: "#FAFAFA",
    border: "#E5E5E5",
    badge: "#E8E8E8",
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
    general: { fg: "#6B7280", bg: "#F8FAFC" },
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
  sm: "6px",
  md: "8px",
  lg: "10px",
  card: "12px",
  pill: "980px",
  kanban: "8px",
} as const;

export const shadows = {
  card: "0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.04)",
  cardHover:
    "0 4px 8px rgba(0, 0, 0, 0.04), 0 10px 20px rgba(0, 0, 0, 0.05)",
} as const;

export const motion = {
  duration: "180ms",
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

/**
 * Typography scale (Plus Jakarta Sans + Outfit display). Sizes in px.
 */
export const typography = {
  fontFamily: {
    sans: [
      '"Plus Jakarta Sans"',
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "sans-serif",
    ],
    display: [
      "Outfit",
      '"Plus Jakarta Sans"',
      "ui-sans-serif",
      "system-ui",
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
    headline: "-0.03em",
    subhead: "-0.015em",
    body: "-0.01em",
    label: "0.04em",
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
