/**
 * Open (or create) an in-app DM and navigate to the discussion thread.
 */

import type { NavigateFunction } from "react-router";

import { ensureDirectMessage } from "./discussion-api";
import { discussionRoomPath } from "./discussion-paths";

export async function openDirectMessage(
  navigate: NavigateFunction,
  memberId: number,
): Promise<void> {
  const room = await ensureDirectMessage(memberId);
  navigate(room.href || discussionRoomPath(room.room_id));
}
