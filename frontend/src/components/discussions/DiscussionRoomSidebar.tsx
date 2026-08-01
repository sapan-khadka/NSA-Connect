import {
  Archive,
  BellOff,
  MessageSquare,
  Pin,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router";

import type {
  DiscussionArchivedRoom,
  DiscussionInboxRoom,
  DiscussionRoom,
} from "../../lib/discussion-api";
import { discussionRoomPath } from "../../lib/discussion-paths";
import { formatCompactRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";
import { DiscussionRoomAvatar } from "./DiscussionRoomAvatar";

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">
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

  function handlePinClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isBoard) {
      onTogglePin(room.room_id);
    }
  }

  const previewAuthor = room.last_message_author;
  const previewText = room.last_message_preview;

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
        "group relative flex min-h-[42px] w-full cursor-pointer items-center gap-2 px-2.5 py-1 transition-colors",
        selected
          ? "bg-[#EFEFEF] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
          : "hover:bg-[#F5F5F4]",
      ].join(" ")}
    >
      {unread && !selected ? (
        <span
          className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
          aria-hidden="true"
        />
      ) : null}
      <DiscussionRoomAvatar room={room} size="xs" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate text-[13px] font-semibold leading-[1.2] text-foreground">
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
                "shrink-0 text-[10px] tabular-nums leading-4",
                unread ? "font-medium text-gray-500" : "text-gray-400",
              ].join(" ")}
            >
              {formatCompactRelativeTimestamp(room.last_message_at)}
            </time>
          ) : null}
        </div>

        <div className="mt-px flex items-center gap-1.5">
          <p className="min-w-0 flex-1 truncate text-[11px] leading-[1.2] text-gray-400">
            {previewText ? (
              <>
                {previewAuthor ? (
                  <span className="font-medium text-gray-500">
                    {previewAuthor}:{" "}
                  </span>
                ) : null}
                <span className={unread ? "text-gray-600" : "text-gray-400"}>
                  {previewText}
                </span>
              </>
            ) : (
              "No messages yet"
            )}
          </p>

          <div className="flex shrink-0 items-center gap-0.5">
            {room.unread_display ? (
              <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[8px] font-semibold tabular-nums leading-none text-white">
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
                "inline-flex h-6 w-6 items-center justify-center rounded-full transition",
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
  const channels = filteredRooms.filter(
    (room) =>
      !room.pinned &&
      room.event_type !== "dm" &&
      room.room_id !== "board",
  );
  const directMessages = filteredRooms.filter(
    (room) => !room.pinned && room.event_type === "dm",
  );
  const hasSearch = query.trim().length > 0;
  const unreadTotal = rooms.reduce((sum, room) => sum + room.unread_count, 0);

  function handleSelect(roomId: string) {
    navigate(discussionRoomPath(roomId));
  }

  function renderRoomList(list: DiscussionInboxRoom[]) {
    return list.map((room) => (
      <DiscussionSidebarRow
        key={room.room_id}
        room={room}
        selected={selectedRoomId === room.room_id}
        onSelect={handleSelect}
        onTogglePin={onTogglePin}
        pinDisabled={pinDisabled}
      />
    ));
  }

  return (
    <aside
      className="discussions-sidebar flex h-full w-full flex-col border-r border-[#EFEFEF] bg-white md:w-[280px] md:shrink-0"
      aria-label="Discussion rooms"
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 px-3">
        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-semibold tracking-tight text-foreground">
            {showArchived ? "Archived" : "Discussions"}
          </h1>
          {!showArchived && unreadTotal > 0 ? (
            <p className="truncate text-[10px] text-gray-500">
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
        <div className="flex shrink-0 items-center gap-1.5 px-2.5 pb-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search conversations</span>
            <AppIcon
              icon={Search}
              size="xs"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search discussions"
              className="w-full rounded-full border-0 bg-[#F3F3F2] py-1.5 pl-8 pr-7 text-[12px] text-foreground outline-none placeholder:text-gray-400 focus:bg-[#EBEBEA]"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-foreground"
              >
                <AppIcon icon={X} size="xs" />
              </button>
            ) : null}
          </label>
          {onNewMessage ? (
            <button
              type="button"
              aria-label="New message"
              onClick={onNewMessage}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-[#F5F5F4] hover:text-foreground"
            >
              <AppIcon icon={MessageSquare} size="xs" />
            </button>
          ) : null}
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
                {renderRoomList(pinned)}
              </div>
            ) : null}

            {channels.length > 0 ? (
              <div>
                <SectionLabel>Channels</SectionLabel>
                {renderRoomList(channels)}
              </div>
            ) : null}

            {directMessages.length > 0 ? (
              <div>
                <SectionLabel>Direct Messages</SectionLabel>
                {renderRoomList(directMessages)}
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
