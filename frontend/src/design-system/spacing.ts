import { spacing } from "./tokens";

/** 8-point grid helpers. Prefer Tailwind `gap-2`/`p-4`/`space-y-6` which map to 8/16/24. */
export const spaceClass = {
  section: "gap-6 space-y-6", // 24px between sections
  cardGap: "gap-4", // 16px between cards
  cardPad: "p-4", // 16px inside cards
  stack: "space-y-4", // 16px vertical stack
  inline: "gap-2", // 8px inline
} as const;

export function spacePx(step: keyof typeof spacing): string {
  return spacing[step];
}
