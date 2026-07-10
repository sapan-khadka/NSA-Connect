import type { HomeActivity } from "./home-activities";

/**
 * Mobile home feed preview: never drops actionable (urgent) items.
 * Fills remaining slots with recent items up to maxItems.
 */
export function getMobileActivityPreview(
  activities: HomeActivity[],
  maxItems = 2,
): HomeActivity[] {
  const actionable = activities.filter((activity) => activity.kind === "actionable");
  const recent = activities.filter((activity) => activity.kind === "recent");

  if (actionable.length === 0) {
    return recent.slice(0, maxItems);
  }

  if (actionable.length >= maxItems) {
    return actionable;
  }

  return [
    ...actionable,
    ...recent.slice(0, maxItems - actionable.length),
  ];
}
