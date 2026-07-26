/**
 * WhatsApp-style group roster — see everyone in the room and DM them.
 * Room owner / board can also set the group photo here.
 */

import { MessageSquare } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "../../design-system/components/Avatar";
import { Drawer } from "../../design-system/components/feedback/Drawer";
import { useAuth } from "../../context/useAuth";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  deleteGroupRoomAvatar,
  fetchDiscussionRoom,
  uploadGroupRoomAvatar,
  type DiscussionRoom,
  type DiscussionRoomMember,
} from "../../lib/discussion-api";
import { openDirectMessage } from "../../lib/open-direct-message";
import { isRoleAtLeast } from "../../lib/roles";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

type DiscussionRoomMembersDrawerProps = {
  open: boolean;
  roomId: number | null;
  onClose: () => void;
  onLoaded?: (room: DiscussionRoom) => void;
  onRoomUpdated?: (room: DiscussionRoom) => void;
};

export function DiscussionRoomMembersDrawer({
  open,
  roomId,
  onClose,
  onLoaded,
  onRoomUpdated,
}: DiscussionRoomMembersDrawerProps) {
  const navigate = useNavigate();
  const { member: currentMember } = useAuth();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [room, setRoom] = useState<DiscussionRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [messagingId, setMessagingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || roomId == null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPhotoError(null);

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

  async function handlePhotoUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || roomId == null) {
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const updated = await uploadGroupRoomAvatar(roomId, file);
      setRoom(updated);
      onLoaded?.(updated);
      onRoomUpdated?.(updated);
    } catch (caught) {
      setPhotoError(getApiErrorMessage(caught));
    } finally {
      setPhotoBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handlePhotoRemove() {
    if (roomId == null) {
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const updated = await deleteGroupRoomAvatar(roomId);
      setRoom(updated);
      onLoaded?.(updated);
      onRoomUpdated?.(updated);
    } catch (caught) {
      setPhotoError(getApiErrorMessage(caught));
    } finally {
      setPhotoBusy(false);
    }
  }

  const members = room?.members ?? [];
  const title = room
    ? `${members.length} member${members.length === 1 ? "" : "s"}`
    : "Members";
  const isGroup = (room?.kind ?? "group") === "group";
  const isOwner = Boolean(
    currentMember &&
      room?.members.some(
        (row) =>
          row.member_id === currentMember.id && row.role === "owner",
      ),
  );
  const isBoard = Boolean(
    currentMember && isRoleAtLeast(currentMember.role, "board"),
  );
  const canManagePhoto = isGroup && (isOwner || isBoard);

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
      ) : (
        <div className="space-y-5">
          {canManagePhoto && room ? (
            <section className="rounded-lg border border-gray-100 bg-surface-muted/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-label">
                Group photo
              </p>
              <div className="mt-3 flex items-center gap-3">
                {room.avatar_url ? (
                  <img
                    src={room.avatar_url}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <Avatar name={room.name} size="lg" />
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif"
                    className="sr-only"
                    onChange={(event) =>
                      void handlePhotoUpload(event.target.files)
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={photoBusy}
                    onClick={() => inputRef.current?.click()}
                  >
                    {photoBusy ? "Saving…" : "Upload"}
                  </Button>
                  {room.avatar_url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={photoBusy}
                      onClick={() => void handlePhotoRemove()}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
              {photoError ? (
                <p className="mt-2 text-xs text-overdue" role="alert">
                  {photoError}
                </p>
              ) : null}
            </section>
          ) : null}

          {members.length === 0 ? (
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
        </div>
      )}
    </Drawer>
  );
}
