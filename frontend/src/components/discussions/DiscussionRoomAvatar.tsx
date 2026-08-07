import { MessagesSquare, Users } from "lucide-react";

import {
  avatarColorFromSeed,
  avatarColorForPerson,
} from "../../lib/avatar-color";
import type { DiscussionInboxRoom } from "../../lib/discussion-api";
import { AppIcon } from "../ui/AppIcon";

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

type DiscussionRoomAvatarProps = {
  room: DiscussionInboxRoom;
  /** Diameter in rem-ish Tailwind size. Default matches home dashboard. */
  size?: "xs" | "sm" | "md";
  className?: string;
};

const SIZE_CLASS = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-[12px]",
} as const;

/**
 * Room avatar matching the home Discussions widget: saturated initials for
 * DMs/events, mint board icon, teal group icon.
 */
export function DiscussionRoomAvatar({
  room,
  size = "md",
  className = "",
}: DiscussionRoomAvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const baseClass = [
    "inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight",
    sizeClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (room.room_id === "board") {
    return (
      <span
        className={`${baseClass} bg-surface-muted text-foreground`}
        aria-hidden="true"
      >
        <AppIcon
          icon={MessagesSquare}
          size={size === "md" ? "sm" : "xs"}
        />
      </span>
    );
  }

  if (room.event_type === "dm") {
    const online = Boolean(room.peer_online);
    return (
      <span
        className="relative inline-flex shrink-0"
        title={online ? "Online" : "Direct message"}
      >
        {room.peer_avatar_url ? (
          <img
            src={room.peer_avatar_url}
            alt=""
            className={`${baseClass} object-cover`}
            aria-hidden="true"
          />
        ) : (
          <span
            className={baseClass}
            style={(() => {
              const palette = avatarColorForPerson(
                room.peer_user_id,
                room.label,
              );
              return {
                backgroundColor: palette.background,
                color: palette.color,
              };
            })()}
            aria-hidden="true"
          >
            {initialsFromLabel(room.label)}
          </span>
        )}
        <span
          className={[
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white",
            online ? "bg-foreground" : "bg-gray-300",
          ].join(" ")}
          aria-label={online ? "Online" : "Offline"}
        />
      </span>
    );
  }

  if (room.event_type === "group" || room.room_id.startsWith("room:")) {
    if (room.avatar_url) {
      return (
        <img
          src={room.avatar_url}
          alt=""
          className={`${baseClass} object-cover`}
          aria-hidden="true"
        />
      );
    }
    return (
      <span
        className={`${baseClass} bg-foreground text-white`}
        aria-hidden="true"
      >
        <AppIcon icon={Users} size={size === "md" ? "sm" : "xs"} />
      </span>
    );
  }

  if (room.avatar_url) {
    return (
      <img
        src={room.avatar_url}
        alt=""
        className={`${baseClass} object-cover`}
        aria-hidden="true"
      />
    );
  }

  const eventPalette = avatarColorFromSeed(room.label || room.room_id);
  return (
    <span
      className={baseClass}
      style={{
        backgroundColor: eventPalette.background,
        color: eventPalette.color,
      }}
      aria-hidden="true"
    >
      {initialsFromLabel(room.label).slice(0, 1)}
    </span>
  );
}
