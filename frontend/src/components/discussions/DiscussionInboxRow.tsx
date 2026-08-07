import { BellOff, Pin } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";

import type { DiscussionInboxRoom } from "../../lib/discussion-api";
import { discussionRoomPath } from "../../lib/discussion-paths";
import { formatCompactRelativeTimestamp } from "../../lib/format-datetime";
import { AppIcon } from "../ui/AppIcon";
import { DiscussionRoomAvatar } from "./DiscussionRoomAvatar";

/**
 * Shared discussion list row — used by Discussions sidebar and Home Inbox rail
 * so avatars, timestamps, previews, and pin affordances stay consistent.
 */
export function DiscussionInboxRow({
  room,
  selected = false,
  onSelect,
  onTogglePin,
  pinDisabled = false,
  pinInteractive = true,
  asLink = false,
}: {
  room: DiscussionInboxRoom;
  selected?: boolean;
  onSelect?: (roomId: string) => void;
  onTogglePin?: (roomId: string) => void;
  pinDisabled?: boolean;
  /** When false, pin is display-only (Home rail). */
  pinInteractive?: boolean;
  /** Navigate via Link (Home). Sidebar uses button/div + onSelect. */
  asLink?: boolean;
}) {
  const unread = room.unread_count > 0;
  const isBoard = room.room_id === "board";
  const muted = Boolean(room.muted);
  const previewAuthor = room.last_message_author;
  const previewText = room.last_message_preview;

  function handlePinClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isBoard && pinInteractive && onTogglePin) {
      onTogglePin(room.room_id);
    }
  }

  const className = [
    "discussion-inbox-row group relative flex min-h-[42px] w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 transition-colors",
    selected
      ? "bg-[#EFEFEF] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
      : room.pinned
        ? "bg-[#F6F6F5] hover:bg-[#F0F0EF]"
        : "hover:bg-[#F5F5F4]",
    unread && !selected ? "is-unread" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body: ReactNode = (
    <>
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
            {room.pinned || pinInteractive ? (
              pinInteractive && !isBoard ? (
                <button
                  type="button"
                  aria-label={
                    room.pinned
                      ? `Unpin ${room.label}`
                      : `Pin ${room.label}`
                  }
                  aria-pressed={room.pinned}
                  disabled={pinDisabled}
                  onClick={handlePinClick}
                  className={[
                    "inline-flex h-6 w-6 items-center justify-center rounded-full transition",
                    room.pinned
                      ? "text-foreground"
                      : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-foreground max-sm:opacity-100",
                  ].join(" ")}
                >
                  <AppIcon
                    icon={Pin}
                    size="xs"
                    className={room.pinned ? "fill-current" : ""}
                  />
                </button>
              ) : room.pinned ? (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center text-foreground"
                  title={
                    isBoard
                      ? "Board Discussion is always pinned"
                      : "Pinned"
                  }
                  aria-hidden
                >
                  <AppIcon icon={Pin} size="xs" className="fill-current" />
                </span>
              ) : null
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  if (asLink) {
    return (
      <Link
        to={discussionRoomPath(room.room_id)}
        className={[className, "no-underline text-inherit"].join(" ")}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={() => onSelect?.(room.room_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(room.room_id);
        }
      }}
      className={className}
    >
      {body}
    </div>
  );
}

export function DiscussionInboxSectionLabel({
  children,
}: {
  children: string;
}) {
  return (
    <p className="discussion-inbox-section-label px-3 pb-0.5 pt-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">
      {children}
    </p>
  );
}

/** Same grouping as Discussions sidebar. */
export function groupDiscussionInboxRooms(rooms: DiscussionInboxRoom[]) {
  const pinned = rooms.filter((room) => room.pinned);
  const channels = rooms.filter(
    (room) =>
      !room.pinned &&
      room.event_type !== "dm" &&
      room.room_id !== "board",
  );
  const directMessages = rooms.filter(
    (room) => !room.pinned && room.event_type === "dm",
  );
  return { pinned, channels, directMessages };
}
