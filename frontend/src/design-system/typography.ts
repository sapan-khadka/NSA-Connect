import { typography } from "./tokens";

/** Utility class names for the CampusOS type scale (Inter). */
export const typeClass = {
  caption: "text-[length:var(--text-caption)] font-medium tracking-[var(--tracking-label)] text-label",
  body: "text-[length:var(--text-body)] font-normal leading-normal text-foreground",
  bodyLg: "text-[length:var(--text-body-lg)] font-normal leading-normal text-foreground",
  title: "text-[length:var(--text-title)] font-semibold tracking-[var(--tracking-subhead)] text-foreground",
  heading: "text-[length:var(--text-heading)] font-semibold tracking-[var(--tracking-headline)] text-foreground",
  display: "text-[length:var(--text-display)] font-bold tracking-[var(--tracking-headline)] text-foreground",
  number: "text-[length:var(--text-number)] font-bold leading-none tracking-tight text-foreground",
  description: "text-[length:var(--text-body)] font-normal text-label",
} as const;

export type TypeClassKey = keyof typeof typeClass;

export function fontFamilySans(): string {
  return typography.fontFamily.sans.join(", ");
}
