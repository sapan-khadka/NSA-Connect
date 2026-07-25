import {
  Archive,
  BellOff,
  MessageSquare,
  MessagesSquare,
  Pin,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

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
import { formatCompactRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

const GROUP_AVATAR_COLOR = "#0F766E";
const DM_AVATAR_COLOR = "#111113";

function RoomAvatar({ room }: { room: DiscussionInboxRoom }) {
  if (room.room_id === "board") {
    return (
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-badge-teal-bg text-primary"
        aria-hidden="true"
      >
        <AppIcon icon={MessagesSquare} size="sm" />
      </span>
    );
  }

  if (room.event_type === "dm") {
    const initial = (room.label.trim().charAt(0) || "?").toUpperCase();
    const online = Boolean(room.peer_online);
    return (
      <span
        className="relative inline-flex h-10 w-10 shrink-0"
        title={online ? "Online" : "Direct message"}
      >
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: DM_AVATAR_COLOR }}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span
          className={[
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white",
            online ? "bg-success" : "bg-gray-300",
          ].join(" ")}
          aria-label={online ? "Online" : "Offline"}
        />
      </span>
    );
  }

  if (room.room_id.startsWith("room:") || room.event_type === "group") {
    return (
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
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
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
      {children}
    </p>
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
  const muted = Boolean(room.muted);
  const isDm = room.event_type === "dm";

  function handlePinClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isBoard) {
      onTogglePin(room.room_id);
    }
  }

  const preview = room.last_message_preview
    ? room.last_message_author
      ? `${room.last_message_author}: ${room.last_message_preview}`
      : room.last_message_preview
    : "No messages yet";

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
        "group relative flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors",
        selected
          ? "bg-surface-muted before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground"
          : "hover:bg-gray-50",
      ].join(" ")}
    >
      <RoomAvatar room={room} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={[
                "truncate text-[13px] leading-5 text-foreground",
                unread ? "font-semibold" : "font-medium",
              ].join(" ")}
            >
              {room.label}
            </p>
            {muted ? (
              <span className="shrink-0 text-gray-400" title="Muted">
                <AppIcon icon={BellOff} size="xs" />
              </span>
            ) : null}
          </div>
          {room.last_message_at ? (
            <time
              dateTime={room.last_message_at}
              className={[
                "shrink-0 text-[11px] tabular-nums leading-5",
                unread ? "font-semibold text-foreground" : "text-gray-400",
              ].join(" ")}
            >
              {formatCompactRelativeTimestamp(room.last_message_at)}
            </time>
          ) : null}
        </div>

        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={[
              "min-w-0 flex-1 truncate text-[12px] leading-4",
              unread ? "font-medium text-gray-700" : "text-gray-500",
              !room.last_message_preview ? "text-gray-400" : "",
            ].join(" ")}
          >
            {isDm && !unread ? (
              <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                DM
              </span>
            ) : null}
            {preview}
          </p>

          <div className="flex shrink-0 items-center gap-1">
            {room.unread_display ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold tabular-nums text-white">
                {room.unread_display}
              </span>
            ) : null}
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
                "inline-flex h-7 w-7 items-center justify-center rounded-full transition",
                room.pinned
                  ? "text-foreground"
                  : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-foreground max-sm:opacity-100",
                isBoard ? "cursor-default" : "",
              ].join(" ")}
            >
              <AppIcon
                icon={Pin}
                size="xs"
                className={room.pinned ? "fill-current" : ""}
              />
            </button>
          </div>
        </div>
      </div>
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
    <div className="border-b border-gray-100 px-3 py-3 last:border-b-0">
      <p className="truncate text-[13px] font-medium text-foreground">
        {room.name}
      </p>
      <p className="mt-0.5 truncate text-[12px] text-gray-500">
        Proposed by {room.created_by_name}
        {room.description ? ` · ${room.description}` : ""}
      </p>
      <div className="mt-2.5 flex gap-2">
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
    <div className="border-b border-gray-100 px-3 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(room.room_id)}
        className="block w-full truncate text-left text-[13px] font-medium text-foreground hover:text-primary"
      >
        {room.label}
      </button>
      <p className="mt-0.5 text-[12px] text-gray-500">
        {room.kind === "board"
          ? "Board Discussion"
          : room.kind === "event"
            ? "Event discussion"
            : "Group"}
        {room.archived_at
          ? ` · archived ${formatCompactRelativeTimestamp(room.archived_at)}`
          : ""}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2.5"
        disabled={busy}
        onClick={() => onRestore(room.room_id)}
      >
        Unarchive
      </Button>
    </div>
  );
}

function HeaderIconButton({
  label,
  pressed,
  onClick,
  icon,
  badge,
  emphasize,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  icon: typeof Archive;
  badge?: number;
  emphasize?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={[
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full transition",
        pressed || emphasize
          ? "bg-surface-muted text-foreground"
          : "text-gray-500 hover:bg-gray-50 hover:text-foreground",
      ].join(" ")}
    >
      <AppIcon icon={icon} size="xs" />
      {badge != null && badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
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
  onNewMessage,
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
  onNewMessage?: () => void;
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
  const [query, setQuery] = useState("");
  const reviewQueue = pendingRooms ?? [];
  const awaiting = awaitingRooms ?? [];
  const archived = archivedRooms ?? [];

  const filteredRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return rooms;
    }
    return rooms.filter((room) => {
      const haystack = [
        room.label,
        room.last_message_preview ?? "",
        room.last_message_author ?? "",
        room.event_type ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rooms, query]);

  const pinned = filteredRooms.filter((room) => room.pinned);
  const unpinned = filteredRooms.filter((room) => !room.pinned);
  const hasSearch = query.trim().length > 0;
  const unreadTotal = rooms.reduce((sum, room) => sum + room.unread_count, 0);

  function handleSelect(roomId: string) {
    navigate(discussionRoomPath(roomId));
  }

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-gray-200 bg-white md:w-[340px] md:shrink-0"
      aria-label="Discussion rooms"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-3.5">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
            {showArchived ? "Archived" : "Discussions"}
          </h1>
          {!showArchived && unreadTotal > 0 ? (
            <p className="truncate text-[11px] text-gray-500">
              {unreadTotal > 99 ? "99+" : unreadTotal} unread
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canManageArchive && onToggleArchived ? (
            <HeaderIconButton
              label={
                showArchived ? "Back to active discussions" : "View archived"
              }
              pressed={showArchived}
              onClick={onToggleArchived}
              icon={Archive}
              badge={!showArchived ? archived.length : undefined}
            />
          ) : null}
          {!showArchived && onNewMessage ? (
            <HeaderIconButton
              label="New message"
              onClick={onNewMessage}
              icon={MessageSquare}
              emphasize
            />
          ) : null}
          {!showArchived && canCreateGroup && onCreateGroup ? (
            <HeaderIconButton
              label="New discussion group"
              onClick={onCreateGroup}
              icon={Plus}
            />
          ) : null}
        </div>
      </div>

      {!showArchived ? (
        <div className="shrink-0 border-b border-gray-100 px-3 py-2.5">
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <AppIcon
              icon={Search}
              size="xs"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats"
              className="w-full rounded-full border border-transparent bg-surface-muted py-2 pl-9 pr-9 text-[13px] text-foreground outline-none placeholder:text-gray-400 focus:border-gray-200 focus:bg-white"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-foreground"
              >
                <AppIcon icon={X} size="xs" />
              </button>
            ) : null}
          </label>
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        role="listbox"
        aria-label={showArchived ? "Archived rooms" : "Rooms"}
      >
        {loading ? (
          <p className="px-4 py-4 text-sm text-gray-500">Loading…</p>
        ) : null}
        {error ? (
          <p className="px-4 py-4 text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : null}

        {showArchived ? (
          <>
            {!loading && archived.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-500">
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
              <div className="border-b border-gray-100">
                <SectionLabel>Pending review</SectionLabel>
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
              <div className="border-b border-gray-100">
                <SectionLabel>Awaiting approval</SectionLabel>
                {awaiting.map((room) => (
                  <div key={room.id} className="px-3 py-2.5">
                    <p className="truncate text-[13px] text-foreground">
                      {room.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-gray-500">
                      Waiting for President or VP
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading &&
            !error &&
            !hasSearch &&
            rooms.length === 0 &&
            reviewQueue.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-foreground">
                  <AppIcon icon={MessageSquare} size="sm" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No conversations yet
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Message a member or start a group to begin.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {onNewMessage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={onNewMessage}
                    >
                      <AppIcon icon={MessageSquare} size="xs" />
                      New message
                    </Button>
                  ) : null}
                  {canCreateGroup && onCreateGroup ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onCreateGroup}
                    >
                      <AppIcon icon={Plus} size="xs" />
                      New group
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!loading &&
            !error &&
            hasSearch &&
            filteredRooms.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-500">
                No chats match “{query.trim()}”.
              </p>
            ) : null}

            {pinned.length > 0 ? (
              <div>
                <SectionLabel>Pinned</SectionLabel>
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
              <div className={pinned.length > 0 ? "pb-2" : "pb-2"}>
                {pinned.length > 0 ? <SectionLabel>Chats</SectionLabel> : null}
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
