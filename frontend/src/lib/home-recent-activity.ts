/**
 * Home "Recent Activity" — personal completion trail for the signed-in member.
 *
 * Product model
 * ─────────────
 * What belongs here: things *you* already did — tasks completed, dues paid,
 * event check-ins, meeting notes you authored. Real timestamps only.
 *
 * How long items stay on Home:
 *  - Window: HOME_ACTIVITY_WINDOW_DAYS (default 30). Older events stay on the
 *    member profile "View all" timeline, not the dashboard.
 *  - Cap: HOME_ACTIVITY_LIMIT (default 5). Newer items push older ones out of
 *    the Home list even if still inside the window.
 *
 * How items are replaced: newest-first. Completing a task today replaces the
 * oldest of the top-N on the next load. Empty means nothing in the window —
 * not that the platform has no history.
 *
 * Org-wide feed (board pulse of everyone's work) is a different product surface
 * and is intentionally not mixed in here.
 */

import type { MemberActivityItem } from "./member-activity-timeline";
import { sortMemberActivityItems } from "./member-activity-timeline";

/** Rows shown in the Home pane. */
export const HOME_ACTIVITY_LIMIT = 5;

/**
 * Only surface personal activity from this many recent calendar days on Home.
 * Profile still shows full history via View all.
 */
export const HOME_ACTIVITY_WINDOW_DAYS = 30;

/**
 * Fetch a wider batch so post-window filtering can still fill the Home cap
 * when several older events exist in the top limit alone.
 */
export const HOME_ACTIVITY_FETCH_LIMIT = 40;

export function isWithinActivityWindow(
  iso: string,
  now: Date = new Date(),
  windowDays: number = HOME_ACTIVITY_WINDOW_DAYS,
): boolean {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) {
    return false;
  }
  const cutoff = now.getTime() - windowDays * 86_400_000;
  return at >= cutoff && at <= now.getTime() + 60_000;
}

/**
 * Newest-first slice for Home after applying the recency window.
 */
export function selectHomeRecentActivity(
  items: MemberActivityItem[],
  {
    now = new Date(),
    limit = HOME_ACTIVITY_LIMIT,
    windowDays = HOME_ACTIVITY_WINDOW_DAYS,
  }: {
    now?: Date;
    limit?: number;
    windowDays?: number;
  } = {},
): MemberActivityItem[] {
  return sortMemberActivityItems(items)
    .filter((item) => isWithinActivityWindow(item.occurredAt, now, windowDays))
    .slice(0, limit);
}
