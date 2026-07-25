/**
 * WhatsApp-style group roster — see everyone in the room and DM them.
 */

import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "../../design-system/components/Avatar";
import { Drawer } from "../../design-system/components/feedback/Drawer";
import { useAuth } from "../../context/useAuth";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  fetchDiscussionRoom,
  type DiscussionRoom,
  type DiscussionRoomMember,
} from "../../lib/discussion-api";
import { openDirectMessage } from "../../lib/open-direct-message";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type DiscussionRoomMembersDrawerProps = {
  open: boolean;
  roomId: number | null;
  onClose: () => void;
  onLoaded?: (room: DiscussionRoom) => void;
};

export function DiscussionRoomMembersDrawer({
  open,
  roomId,
  onClose,
  onLoaded,
}: DiscussionRoomMembersDrawerProps) {
  const navigate = useNavigate();
  const { member: currentMember } = useAuth();
  const [room, setRoom] = useState<DiscussionRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || roomId == null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchDiscussionRoom(roomId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setRoom(detail);
        onLoaded?.(detail);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setRoom(null);
          setError(getApiErrorMessage(fetchError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, roomId, onLoaded]);

  async function handleMessage(peer: DiscussionRoomMember) {
    if (
      !currentMember ||
      peer.member_id === currentMember.id ||
      messagingId != null
    ) {
      return;
    }
    setMessagingId(peer.member_id);
    try {
      onClose();
      await openDirectMessage(navigate, peer.member_id);
    } catch (messageError) {
      window.alert(getApiErrorMessage(messageError));
    } finally {
      setMessagingId(null);
    }
  }

  const members = room?.members ?? [];
  const title = room
    ? `${members.length} member${members.length === 1 ? "" : "s"}`
    : "Members";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="sm"
      closeOnBackdrop
      showClose
      title={title}
      description={room?.name ?? "People in this group"}
      className="discussion-room-members-drawer"
    >
      {loading ? (
        <p className="px-1 py-6 text-sm text-gray-500">Loading members…</p>
      ) : error ? (
        <p
          className="px-1 py-6 text-sm text-[var(--status-danger-text)]"
          role="alert"
        >
          {error}
        </p>
      ) : members.length === 0 ? (
        <p className="px-1 py-6 text-sm text-gray-500">No members yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100" aria-label="Group members">
          {members.map((peer) => {
            const isSelf = currentMember?.id === peer.member_id;
            return (
              <li
                key={peer.member_id}
                className="flex items-center gap-3 py-3 first:pt-1"
              >
                <Avatar
                  name={peer.full_name}
                  size="md"
                  className="shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {peer.full_name}
                    {isSelf ? (
                      <span className="ml-1.5 text-xs font-normal text-gray-400">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs capitalize text-gray-500">
                    {peer.role === "owner" ? "Owner" : "Member"}
                  </p>
                </div>
                {isSelf ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Message ${peer.full_name}`}
                    loading={messagingId === peer.member_id}
                    disabled={messagingId != null}
                    onClick={() => {
                      void handleMessage(peer);
                    }}
                  >
                    <AppIcon
                      icon={MessageSquare}
                      size="xs"
                      className="text-current"
                    />
                    Message
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
