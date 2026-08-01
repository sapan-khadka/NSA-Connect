import { typography } from "./tokens";

/**
 * CampusOS type utilities.
 * Body/UI → Plus Jakarta Sans. Display titles → Outfit (`font-display`).
 */
export const typeClass = {
  caption:
    "font-sans text-[length:var(--text-caption)] font-medium tracking-[var(--tracking-label)] text-label",
  body: "font-sans text-[length:var(--text-body)] font-normal leading-normal text-foreground",
  bodyLg:
    "font-sans text-[length:var(--text-body-lg)] font-normal leading-normal text-foreground",
  title:
    "font-sans text-[length:var(--text-title)] font-semibold tracking-[var(--tracking-subhead)] text-foreground",
  heading:
    "font-display text-[length:var(--text-heading)] font-semibold tracking-[var(--tracking-headline)] text-foreground",
  display:
    "font-display text-[length:var(--text-display)] font-semibold tracking-[var(--tracking-headline)] text-foreground",
  number:
    "font-sans text-[length:var(--text-number)] font-bold leading-none tracking-tight text-foreground",
  description: "font-sans text-[length:var(--text-body)] font-normal text-label",
} as const;

export type TypeClassKey = keyof typeof typeClass;

export function fontFamilySans(): string {
  return typography.fontFamily.sans.join(", ");
}

export function fontFamilyDisplay(): string {
  return typography.fontFamily.display.join(", ");
}
