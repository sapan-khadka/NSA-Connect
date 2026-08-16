import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  CheckCheck,
  Pin,
  PinOff,
  Shield,
} from "lucide-react";

import type { DiscussionInboxRoom } from "../../lib/discussion-api";
import { Drawer } from "../../design-system/components/feedback/Drawer";
import { AppIcon } from "../ui/AppIcon";
import { DiscussionRoomAvatar } from "./DiscussionRoomAvatar";

export type DiscussionInboxActionId =
  | "pin"
  | "mute"
  | "markRead"
  | "archiveForMe"
  | "archiveChapter";

type DiscussionInboxActionSheetProps = {
  room: DiscussionInboxRoom | null;
  open: boolean;
  onClose: () => void;
  canOrgArchive?: boolean;
  pinDisabled?: boolean;
  onAction: (action: DiscussionInboxActionId, room: DiscussionInboxRoom) => void;
};

function ActionButton({
  icon,
  label,
  description,
  tone = "default",
  disabled,
  onClick,
}: {
  icon: typeof Pin;
  label: string;
  description?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
        "hover:bg-[#F5F5F4] active:bg-[#EFEFEE]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        tone === "danger" ? "text-overdue" : "text-foreground",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          tone === "danger"
            ? "bg-[#FEF2F2] text-overdue"
            : "bg-[#F3F3F2] text-foreground",
        ].join(" ")}
      >
        <AppIcon icon={icon} size="sm" className="text-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-tight">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-gray-500">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function roomKindLabel(room: DiscussionInboxRoom): string {
  if (room.event_type === "dm") {
    return "Direct message";
  }
  if (room.room_id === "board") {
    return "Board channel";
  }
  if (room.event_type) {
    return "Event channel";
  }
  return "Group";
}

/**
 * Mobile-first bottom sheet for discussion list actions (long-press).
 */
export function DiscussionInboxActionSheet({
  room,
  open,
  onClose,
  canOrgArchive = false,
  pinDisabled = false,
  onAction,
}: DiscussionInboxActionSheetProps) {
  if (!room) {
    return null;
  }

  const selectedRoom = room;
  const isDm = selectedRoom.event_type === "dm";
  const archivedForMe = Boolean(selectedRoom.archived_for_me);
  const showMarkRead = selectedRoom.unread_count > 0 && !archivedForMe;
  // Chapter-wide archive: Pres/VP only, never DMs (backend rule).
  const showChapterArchive = canOrgArchive && !isDm && !archivedForMe;

  function run(action: DiscussionInboxActionId) {
    onAction(action, selectedRoom);
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="bottom"
      size="md"
      closeOnBackdrop
      showClose
      className="pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      title="Chat options"
      description={room.label}
    >
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#F7F7F6] px-3 py-2.5">
        <DiscussionRoomAvatar room={room} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-foreground">
            {room.label}
          </p>
          <p className="truncate text-[12px] text-gray-500">
            {roomKindLabel(room)}
          </p>
        </div>
      </div>

      <div className="-mx-1 flex flex-col gap-0.5 pb-1">
        {!archivedForMe ? (
          <>
            <ActionButton
              icon={room.pinned ? PinOff : Pin}
              label={room.pinned ? "Unpin chat" : "Pin chat"}
              description={
                room.pinned
                  ? "Remove from the Pinned section"
                  : "Keep this chat at the top"
              }
              disabled={pinDisabled}
              onClick={() => run("pin")}
            />
            <ActionButton
              icon={room.muted ? Bell : BellOff}
              label={room.muted ? "Unmute" : "Mute notifications"}
              description={
                room.muted
                  ? "Show this chat in your attention feed again"
                  : "Hide non-mention alerts for this chat"
              }
              onClick={() => run("mute")}
            />
            {showMarkRead ? (
              <ActionButton
                icon={CheckCheck}
                label="Mark as read"
                description="Clear the unread badge"
                onClick={() => run("markRead")}
              />
            ) : null}
          </>
        ) : null}

        <ActionButton
          icon={archivedForMe ? ArchiveRestore : Archive}
          label={archivedForMe ? "Unarchive for me" : "Archive for me"}
          description={
            archivedForMe
              ? "Return this chat to your active list"
              : "Hide from your inbox only. Others are unaffected."
          }
          onClick={() => run("archiveForMe")}
        />

        {showChapterArchive ? (
          <ActionButton
            icon={Shield}
            label="Archive for chapter"
            description="Remove from everyone's Discussions (President / VP)"
            tone="danger"
            onClick={() => run("archiveChapter")}
          />
        ) : null}
      </div>
    </Drawer>
  );
}
