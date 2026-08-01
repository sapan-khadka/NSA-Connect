import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import {
  fetchDiscussionInbox,
  postBoardDiscussion,
  postCustomRoomDiscussion,
  postEventDiscussion,
  type DiscussionInboxRoom,
  type DiscussionMessage,
} from "../../lib/discussion-api";
import { formatForwardedContent } from "../../lib/discussion-mentions";
import { discussionRoomPath } from "../../lib/discussion-paths";
import { getApiErrorMessage } from "../../lib/api-error";
import { Button } from "../ui/Button";

export function ForwardMessageModal({
  open,
  message,
  currentRoomId,
  onClose,
}: {
  open: boolean;
  message: DiscussionMessage | null;
  currentRoomId?: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setError(null);
    setQuery("");
    void fetchDiscussionInbox()
      .then((inbox) => {
        if (!cancelled) {
          setRooms(inbox.rooms);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(getApiErrorMessage(caught, "Could not load chats"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (currentRoomId && room.room_id === currentRoomId) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return room.label.toLowerCase().includes(needle);
    });
  }, [rooms, query, currentRoomId]);

  if (!open || message == null) {
    return null;
  }

  const content = formatForwardedContent(message);

  async function forwardTo(room: DiscussionInboxRoom) {
    setBusyId(room.room_id);
    setError(null);
    try {
      if (room.room_id === "board") {
        await postBoardDiscussion(content);
      } else if (room.room_id.startsWith("event:")) {
        const eventId = Number(room.room_id.slice("event:".length));
        await postEventDiscussion(eventId, content);
      } else if (room.room_id.startsWith("room:")) {
        const roomId = Number(room.room_id.slice("room:".length));
        await postCustomRoomDiscussion(roomId, content);
      } else {
        throw new Error("Unsupported chat");
      }
      onClose();
      navigate(discussionRoomPath(room.room_id));
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not forward message"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Forward message"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#EBEBEA] bg-white shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#F0F0EE] px-4 py-3">
          <p className="text-[15px] font-semibold text-foreground">Forward to…</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-gray-500">{content}</p>
        </div>
        <div className="px-4 pt-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-lg border-0 bg-[#F5F5F4] px-3 py-2 text-[13px] outline-none placeholder:text-gray-400"
          />
        </div>
        {error ? (
          <p className="px-4 pt-2 text-[12px] text-overdue" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="max-h-72 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <li className="px-2 py-6 text-center text-[13px] text-gray-500">
              No chats found
            </li>
          ) : (
            filtered.map((room) => (
              <li key={room.room_id}>
                <button
                  type="button"
                  disabled={busyId != null}
                  onClick={() => void forwardTo(room)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] transition hover:bg-[#F5F5F4] disabled:opacity-60"
                >
                  <span className="truncate font-medium text-foreground">
                    {room.label}
                  </span>
                  {busyId === room.room_id ? (
                    <span className="text-[11px] text-gray-400">Sending…</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex justify-end border-t border-[#F0F0EE] px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
