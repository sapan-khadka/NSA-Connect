import { MessagesSquare, Pin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MouseEvent } from "react";

import {
  EVENT_TYPE_COLOR,
  type EventType,
} from "../../lib/event-types";
import type { DiscussionInboxRoom } from "../../lib/discussion-api";
import { discussionRoomPath } from "../../lib/discussion-paths";
import { formatRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";

function RoomAvatar({ room }: { room: DiscussionInboxRoom }) {
  if (room.room_id === "board") {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-badge-teal-bg text-primary"
        aria-hidden="true"
      >
        <AppIcon icon={MessagesSquare} size="sm" />
      </span>
    );
  }

  const eventType = (room.event_type ?? "cultural") as EventType;
  const color = EVENT_TYPE_COLOR[eventType] ?? EVENT_TYPE_COLOR.cultural;
  const initial = (room.label.trim().charAt(0) || "?").toUpperCase();

  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function DiscussionSidebarRow({
  room,
  selected,
  onSelect,
  onTogglePin,
  pinDisabled,
}: {
  room: DiscussionInboxRoom;
  selected: boolean;
  onSelect: (roomId: string) => void;
  onTogglePin: (roomId: string) => void;
  pinDisabled?: boolean;
}) {
  const unread = room.unread_count > 0;
  const isBoard = room.room_id === "board";

  function handlePinClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isBoard) {
      onTogglePin(room.room_id);
    }
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect(room.room_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(room.room_id);
        }
      }}
      className={[
        "group flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors",
        selected ? "bg-badge-teal-bg/50" : "hover:bg-gray-50",
      ].join(" ")}
    >
      <RoomAvatar room={room} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={[
              "truncate text-sm text-foreground",
              unread ? "font-semibold" : "font-normal",
            ].join(" ")}
          >
            {room.label}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {room.unread_display ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                {room.unread_display}
              </span>
            ) : null}
            {room.last_message_at ? (
              <time
                dateTime={room.last_message_at}
                className="text-xs text-gray-500"
              >
                {formatRelativeTimestamp(room.last_message_at)}
              </time>
            ) : null}
          </div>
        </div>
        {room.last_message_preview ? (
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {room.last_message_author
              ? `${room.last_message_author}: ${room.last_message_preview}`
              : room.last_message_preview}
          </p>
        ) : (
          <p className="mt-0.5 truncate text-xs text-gray-400">No messages yet</p>
        )}
      </div>
      <button
        type="button"
        aria-label={
          isBoard
            ? "Board Discussion is always pinned"
            : room.pinned
              ? `Unpin ${room.label}`
              : `Pin ${room.label}`
        }
        aria-pressed={room.pinned}
        disabled={pinDisabled || isBoard}
        onClick={handlePinClick}
        className={[
          "mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
          room.pinned
            ? "text-primary"
            : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-foreground max-sm:opacity-100",
        ].join(" ")}
      >
        <AppIcon
          icon={Pin}
          size="xs"
          className={room.pinned ? "fill-current" : ""}
        />
      </button>
    </div>
  );
}

export function DiscussionRoomSidebar({
  rooms,
  selectedRoomId,
  onTogglePin,
  pinDisabled,
  loading,
  error,
}: {
  rooms: DiscussionInboxRoom[];
  selectedRoomId: string | null;
  onTogglePin: (roomId: string) => void;
  pinDisabled?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  const navigate = useNavigate();
  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);

  function handleSelect(roomId: string) {
    navigate(discussionRoomPath(roomId));
  }

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-gray-200 bg-white md:w-[320px] md:shrink-0"
      aria-label="Discussion rooms"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-gray-200 px-4">
        <h1 className="text-base font-medium text-foreground">Discussions</h1>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        role="listbox"
        aria-label="Rooms"
      >
        {loading ? (
          <p className="px-4 py-3 text-sm text-gray-500">Loading…</p>
        ) : null}
        {error ? (
          <p className="px-4 py-3 text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && rooms.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">No discussions yet</p>
        ) : null}

        {pinned.length > 0 ? (
          <div className="pt-3">
            <p className="px-4 pb-1 text-xs font-medium tracking-wide text-gray-400">
              PINNED
            </p>
            {pinned.map((room) => (
              <DiscussionSidebarRow
                key={room.room_id}
                room={room}
                selected={selectedRoomId === room.room_id}
                onSelect={handleSelect}
                onTogglePin={onTogglePin}
                pinDisabled={pinDisabled}
              />
            ))}
          </div>
        ) : null}

        {unpinned.length > 0 ? (
          <div className={pinned.length > 0 ? "pt-2" : "pt-1"}>
            {unpinned.map((room) => (
              <DiscussionSidebarRow
                key={room.room_id}
                room={room}
                selected={selectedRoomId === room.room_id}
                onSelect={handleSelect}
                onTogglePin={onTogglePin}
                pinDisabled={pinDisabled}
              />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
