/**
 * App-wide icon sizing and stroke tokens.
 *
 * Library: lucide-react (single source for all UI glyphs).
 *
 * Sizes by context:
 * - xs (14px): compact badges
 * - sm (16px): inline with text, section labels, button icons
 * - md (20px): navigation, empty-state graphics
 * - lg (24px): lightbox / large standalone controls
 * - xl (32px): interactive rating, empty media placeholders, hero status
 */
export const ICON_STROKE = 1.75;

export const ICON_SIZE_CLASS = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
} as const;

export type IconSize = keyof typeof ICON_SIZE_CLASS;

/** Default gap between an icon and adjacent label text. */
export const ICON_LABEL_GAP_CLASS = "gap-1.5";

export function iconClassName(
  size: IconSize = "sm",
  ...extra: Array<string | false | null | undefined>
): string {
  return [ICON_SIZE_CLASS[size], "shrink-0", ...extra]
    .filter(Boolean)
    .join(" ");
}
