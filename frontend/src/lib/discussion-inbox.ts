import type { DiscussionInboxRoom } from "./discussion-api";

/** Pin + recency order used by the Discussions page and Inbox rail. */
export function sortDiscussionInboxRooms(
  rooms: DiscussionInboxRoom[],
): DiscussionInboxRoom[] {
  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);
  return [
    ...pinned.sort((a, b) => {
      if (a.room_id === "board") return -1;
      if (b.room_id === "board") return 1;
      return (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "");
    }),
    ...unpinned.sort((a, b) =>
      (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
    ),
  ];
}
