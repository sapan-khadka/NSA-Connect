/** Client paths for the two-pane Discussions workspace. */

export function discussionRoomPath(roomId: string): string {
  if (roomId === "board") {
    return "/discussions/board";
  }
  const match = /^event:(\d+)$/.exec(roomId);
  if (match) {
    return `/discussions/event/${match[1]}`;
  }
  return "/discussions";
}

export function discussionScopeFromPath(pathname: string): {
  type: "board";
} | {
  type: "event";
  eventId: number;
} | null {
  if (pathname === "/discussions/board") {
    return { type: "board" };
  }
  const match = /^\/discussions\/event\/(\d+)$/.exec(pathname);
  if (match) {
    const eventId = Number(match[1]);
    if (Number.isFinite(eventId) && eventId > 0) {
      return { type: "event", eventId };
    }
  }
  return null;
}

export function discussionRoomIdFromPath(pathname: string): string | null {
  const scope = discussionScopeFromPath(pathname);
  if (!scope) {
    return null;
  }
  return scope.type === "board" ? "board" : `event:${scope.eventId}`;
}
