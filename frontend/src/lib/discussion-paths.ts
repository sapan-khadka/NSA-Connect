/** Client paths for the two-pane Discussions workspace. */

export type DiscussionPathScope =
  | { type: "board" }
  | { type: "event"; eventId: number }
  | { type: "room"; roomId: number };

export function discussionRoomPath(roomId: string): string {
  if (roomId === "board") {
    return "/discussions/board";
  }
  const eventMatch = /^event:(\d+)$/.exec(roomId);
  if (eventMatch) {
    return `/discussions/event/${eventMatch[1]}`;
  }
  const roomMatch = /^room:(\d+)$/.exec(roomId);
  if (roomMatch) {
    return `/discussions/room/${roomMatch[1]}`;
  }
  return "/discussions";
}

export function discussionScopeFromPath(
  pathname: string,
): DiscussionPathScope | null {
  if (pathname === "/discussions/board") {
    return { type: "board" };
  }
  const eventMatch = /^\/discussions\/event\/(\d+)$/.exec(pathname);
  if (eventMatch) {
    const eventId = Number(eventMatch[1]);
    if (Number.isFinite(eventId) && eventId > 0) {
      return { type: "event", eventId };
    }
  }
  const roomMatch = /^\/discussions\/room\/(\d+)$/.exec(pathname);
  if (roomMatch) {
    const roomId = Number(roomMatch[1]);
    if (Number.isFinite(roomId) && roomId > 0) {
      return { type: "room", roomId };
    }
  }
  return null;
}

export function discussionRoomIdFromPath(pathname: string): string | null {
  const scope = discussionScopeFromPath(pathname);
  if (!scope) {
    return null;
  }
  if (scope.type === "board") {
    return "board";
  }
  if (scope.type === "event") {
    return `event:${scope.eventId}`;
  }
  return `room:${scope.roomId}`;
}
