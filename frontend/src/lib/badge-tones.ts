/**
 * Pastel icon-badge tones for category-based coloring.
 * Values come from CampusOS design tokens — do not hardcode hex here.
 */
import { colors } from "../design-system/tokens";

export const BADGE_TONES = {
  green: {
    bg: colors.badge.green.bg,
    fg: colors.badge.green.fg,
  },
  purple: {
    bg: colors.badge.purple.bg,
    fg: colors.badge.purple.fg,
  },
  blue: {
    bg: colors.badge.blue.bg,
    fg: colors.badge.blue.fg,
  },
  teal: {
    bg: colors.badge.teal.bg,
    fg: colors.badge.teal.fg,
  },
  coral: {
    bg: colors.badge.coral.bg,
    fg: colors.badge.coral.fg,
  },
  amber: {
    bg: colors.badge.amber.bg,
    fg: colors.badge.amber.fg,
  },
  red: {
    bg: colors.badge.red.bg,
    fg: colors.badge.red.fg,
  },
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

/** Semantic mapping: what the icon represents → badge tone */
export const BADGE_CATEGORY = {
  tasks: "green",
  events: "purple",
  members: "blue",
  finance: "teal",
  tools: "coral",
  warning: "amber",
  urgent: "red",
  announcements: "purple",
  assistant: "coral",
  reports: "blue",
  admin: "amber",
  home: "teal",
} as const satisfies Record<string, BadgeTone>;

export type BadgeCategory = keyof typeof BADGE_CATEGORY;

export function badgeToneForCategory(category: BadgeCategory): BadgeTone {
  return BADGE_CATEGORY[category];
}
