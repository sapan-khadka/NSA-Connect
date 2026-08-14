/**
 * Shared in-app "back" navigation for detail pages.
 *
 * React Router stores an `idx` on history.state. Use that (not history.length)
 * to decide if we can safely go back inside the SPA.
 */

export function getRouterHistoryIndex(
  state: unknown = window.history.state,
): number {
  if (
    state != null &&
    typeof state === "object" &&
    "idx" in state &&
    typeof (state as { idx: unknown }).idx === "number"
  ) {
    return (state as { idx: number }).idx;
  }
  return 0;
}

/** True when the SPA has prior in-app history we can pop. */
export function canNavigateBackInApp(
  state: unknown = window.history.state,
): boolean {
  return getRouterHistoryIndex(state) > 0;
}

/**
 * Prefer in-app history when available; otherwise go to the parent route.
 * Always use this for generic "Back" buttons so deep links still work.
 */
export function resolveBackNavigation(
  fallbackTo: string,
  state: unknown = window.history.state,
): { type: "history" } | { type: "path"; to: string } {
  if (canNavigateBackInApp(state)) {
    return { type: "history" };
  }
  return { type: "path", to: fallbackTo };
}
