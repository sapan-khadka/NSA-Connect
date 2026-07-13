import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { DiscussionFeed } from "../components/DiscussionFeed";
import { DiscussionRoomSidebar } from "../components/discussions/DiscussionRoomSidebar";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  fetchDiscussionInbox,
  toggleDiscussionRoomPin,
  type DiscussionInboxRoom,
} from "../lib/discussion-api";
import {
  discussionRoomIdFromPath,
  discussionRoomPath,
  discussionScopeFromPath,
} from "../lib/discussion-paths";

const INBOX_POLL_MS = 12_000;

function sortRooms(rooms: DiscussionInboxRoom[]): DiscussionInboxRoom[] {
  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);
  return [
    ...pinned.sort((a, b) => {
      if (a.room_id === "board") return -1;
      if (b.room_id === "board") return 1;
      return (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "");
    }),
    ...unpinned.sort((a, b) =>
      (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
    ),
  ];
}

export function DiscussionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const selectedRoomId = discussionRoomIdFromPath(location.pathname);
  const scope = discussionScopeFromPath(location.pathname);

  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await fetchDiscussionInbox();
        if (!cancelled) {
          setRooms(sortRooms(response.rooms));
        }
      } catch {
        if (!cancelled && !opts?.silent) {
          setRooms([]);
          setError("Could not load discussions.");
        }
      } finally {
        if (!cancelled && !opts?.silent) {
          setLoading(false);
        }
      }
    }

    void load();

    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }, INBOX_POLL_MS);

    function handleFocus() {
      void load({ silent: true });
    }

    window.addEventListener("focus", handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Clear unread badge immediately when a room is opened (mark-read runs in feed).
  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    setRooms((current) =>
      current.map((room) =>
        room.room_id === selectedRoomId
          ? { ...room, unread_count: 0, unread_display: null }
          : room,
      ),
    );
  }, [selectedRoomId]);

  // Desktop: if landing on /discussions with rooms, open the first one.
  useEffect(() => {
    if (!isMdUp || loading || selectedRoomId || rooms.length === 0) {
      return;
    }
    navigate(discussionRoomPath(rooms[0].room_id), { replace: true });
  }, [isMdUp, loading, selectedRoomId, rooms, navigate]);

  async function handleTogglePin(roomId: string) {
    if (roomId === "board") {
      return;
    }
    const previous = rooms;
    setRooms((current) =>
      sortRooms(
        current.map((room) =>
          room.room_id === roomId
            ? {
                ...room,
                pinned: !room.pinned,
                pinned_at: room.pinned ? null : new Date().toISOString(),
              }
            : room,
        ),
      ),
    );
    setPinningId(roomId);
    try {
      const result = await toggleDiscussionRoomPin(roomId);
      setRooms((current) =>
        sortRooms(
          current.map((room) =>
            room.room_id === result.room_id
              ? {
                  ...room,
                  pinned: result.pinned,
                  pinned_at: result.pinned
                    ? (room.pinned_at ?? new Date().toISOString())
                    : null,
                }
              : room,
          ),
        ),
      );
    } catch {
      setRooms(previous);
    } finally {
      setPinningId(null);
    }
  }

  const selectedRoom = rooms.find((room) => room.room_id === selectedRoomId);
  const showList = isMdUp || !selectedRoomId;
  const showThread = isMdUp || Boolean(selectedRoomId);

  const feedTitle =
    selectedRoom?.label ??
    (scope?.type === "board" ? "Board Discussion" : "Discussion");
  const feedDescription =
    scope?.type === "board" ? "Visible to board members and above" : undefined;

  // Invalid deep link → bounce to inbox root.
  if (
    location.pathname.startsWith("/discussions/") &&
    location.pathname !== "/discussions/board" &&
    !/^\/discussions\/event\/\d+$/.test(location.pathname)
  ) {
    return <Navigate to="/discussions" replace />;
  }

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-4rem-1.25rem)] min-h-[28rem] overflow-hidden border-y border-gray-200 bg-white sm:-mx-6 sm:-my-6 sm:h-[calc(100dvh-4rem-1.5rem)] lg:-mx-8 lg:h-[calc(100dvh-4rem-1.5rem)] xl:-mx-10">
      {showList ? (
        <DiscussionRoomSidebar
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onTogglePin={handleTogglePin}
          pinDisabled={pinningId != null}
          loading={loading}
          error={error}
        />
      ) : null}

      {showThread ? (
        <div className="flex min-w-0 flex-1 flex-col">
          {scope ? (
            <DiscussionFeed
              key={selectedRoomId ?? "none"}
              title={feedTitle}
              description={feedDescription}
              scope={scope}
              variant="pane"
              onBack={() => navigate("/discussions")}
              className="h-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-sm text-gray-500">
              Select a conversation
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
