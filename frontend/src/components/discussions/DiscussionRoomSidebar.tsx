import { Archive, MessagesSquare, Pin, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { MouseEvent } from "react";

import {
  EVENT_TYPE_COLOR,
  type EventType,
} from "../../lib/event-types";
import type {
  DiscussionArchivedRoom,
  DiscussionInboxRoom,
  DiscussionRoom,
} from "../../lib/discussion-api";
import { discussionRoomPath } from "../../lib/discussion-paths";
import { formatRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

const GROUP_AVATAR_COLOR = "#0F766E";

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

  if (room.room_id.startsWith("room:") || room.event_type === "group") {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: GROUP_AVATAR_COLOR }}
        aria-hidden="true"
      >
        <AppIcon icon={Users} size="sm" />
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

function PendingReviewRow({
  room,
  busy,
  onApprove,
  onReject,
}: {
  room: DiscussionRoom;
  busy: boolean;
  onApprove: (roomId: number) => void;
  onReject: (roomId: number) => void;
}) {
  return (
    <div className="border-b border-gray-100 px-3 py-2.5 last:border-b-0">
      <p className="truncate text-sm font-medium text-foreground">{room.name}</p>
      <p className="mt-0.5 truncate text-xs text-gray-500">
        Proposed by {room.created_by_name}
        {room.description ? ` · ${room.description}` : ""}
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={busy}
          onClick={() => onApprove(room.id)}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onReject(room.id)}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}

function ArchivedRoomRow({
  room,
  busy,
  onRestore,
  onOpen,
}: {
  room: DiscussionArchivedRoom;
  busy: boolean;
  onRestore: (roomId: string) => void;
  onOpen: (roomId: string) => void;
}) {
  return (
    <div className="border-b border-gray-100 px-3 py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(room.room_id)}
        className="block w-full truncate text-left text-sm font-medium text-foreground hover:text-primary"
      >
        {room.label}
      </button>
      <p className="mt-0.5 text-xs text-gray-500">
        {room.kind === "board"
          ? "Board Discussion"
          : room.kind === "event"
            ? "Event discussion"
            : "Group"}
        {room.archived_at
          ? ` · archived ${formatRelativeTimestamp(room.archived_at)}`
          : ""}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        disabled={busy}
        onClick={() => onRestore(room.room_id)}
      >
        Unarchive
      </Button>
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
  canCreateGroup,
  onCreateGroup,
  pendingRooms,
  pendingBusyId,
  onApprovePending,
  onRejectPending,
  awaitingRooms,
  canManageArchive,
  showArchived,
  onToggleArchived,
  archivedRooms,
  unarchivingId,
  onUnarchive,
}: {
  rooms: DiscussionInboxRoom[];
  selectedRoomId: string | null;
  onTogglePin: (roomId: string) => void;
  pinDisabled?: boolean;
  loading?: boolean;
  error?: string | null;
  canCreateGroup?: boolean;
  onCreateGroup?: () => void;
  pendingRooms?: DiscussionRoom[];
  pendingBusyId?: number | null;
  onApprovePending?: (roomId: number) => void;
  onRejectPending?: (roomId: number) => void;
  awaitingRooms?: DiscussionRoom[];
  canManageArchive?: boolean;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  archivedRooms?: DiscussionArchivedRoom[];
  unarchivingId?: string | null;
  onUnarchive?: (roomId: string) => void;
}) {
  const navigate = useNavigate();
  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);
  const reviewQueue = pendingRooms ?? [];
  const awaiting = awaitingRooms ?? [];
  const archived = archivedRooms ?? [];

  function handleSelect(roomId: string) {
    navigate(discussionRoomPath(roomId));
  }

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-gray-200 bg-white md:w-[320px] md:shrink-0"
      aria-label="Discussion rooms"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3">
        <h1 className="truncate text-base font-medium text-foreground">
          {showArchived ? "Archived" : "Discussions"}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          {canManageArchive && onToggleArchived ? (
            <Button
              type="button"
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              onClick={onToggleArchived}
              aria-pressed={showArchived}
              aria-label={
                showArchived ? "Back to active discussions" : "View archived"
              }
            >
              <AppIcon icon={Archive} size="xs" />
              {showArchived ? "Active" : "Archived"}
              {!showArchived && archived.length > 0 ? (
                <span className="tabular-nums">{archived.length}</span>
              ) : null}
            </Button>
          ) : null}
          {!showArchived && canCreateGroup && onCreateGroup ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCreateGroup}
              aria-label="New discussion group"
            >
              <AppIcon icon={Plus} size="xs" />
              New group
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        role="listbox"
        aria-label={showArchived ? "Archived rooms" : "Rooms"}
      >
        {loading ? (
          <p className="px-4 py-3 text-sm text-gray-500">Loading…</p>
        ) : null}
        {error ? (
          <p className="px-4 py-3 text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : null}

        {showArchived ? (
          <>
            {!loading && archived.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-500">
                No archived discussions
              </p>
            ) : null}
            {archived.map((room) => (
              <ArchivedRoomRow
                key={room.room_id}
                room={room}
                busy={unarchivingId === room.room_id}
                onRestore={(roomId) => onUnarchive?.(roomId)}
                onOpen={handleSelect}
              />
            ))}
          </>
        ) : (
          <>
            {reviewQueue.length > 0 &&
            onApprovePending &&
            onRejectPending ? (
              <div className="border-b border-gray-200 pt-3">
                <p className="px-4 pb-1 text-xs font-medium tracking-wide text-gray-400">
                  PENDING REVIEW
                </p>
                {reviewQueue.map((room) => (
                  <PendingReviewRow
                    key={room.id}
                    room={room}
                    busy={pendingBusyId === room.id}
                    onApprove={onApprovePending}
                    onReject={onRejectPending}
                  />
                ))}
              </div>
            ) : null}

            {awaiting.length > 0 ? (
              <div className="border-b border-gray-200 pt-3">
                <p className="px-4 pb-1 text-xs font-medium tracking-wide text-gray-400">
                  AWAITING APPROVAL
                </p>
                {awaiting.map((room) => (
                  <div key={room.id} className="px-3 py-2.5">
                    <p className="truncate text-sm text-foreground">{room.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Waiting for President or VP
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && !error && rooms.length === 0 && reviewQueue.length === 0 ? (
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
          </>
        )}
      </div>
    </aside>
  );
}
