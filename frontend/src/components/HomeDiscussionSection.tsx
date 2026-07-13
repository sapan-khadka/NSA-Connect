import { Pin } from "lucide-react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  fetchDiscussionInbox,
  toggleDiscussionRoomPin,
  type DiscussionInboxRoom,
} from "../lib/discussion-api";
import { discussionRoomPath } from "../lib/discussion-paths";
import { formatRelativeTimestamp } from "../lib/format-datetime";
import { ArrowLink } from "./ui/ArrowLink";
import { AppIcon } from "./ui/AppIcon";
import { HomeCard } from "./ui/HomeCard";

const INBOX_PATH = "/discussions";
const HOME_ROW_CAP = 6;
const INBOX_POLL_MS = 12_000;

function DiscussionCardShell({
  children,
  headerAction,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="home-section-title">Discussion</h2>
        {headerAction}
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {children}
      </div>
    </HomeCard>
  );
}

export function selectHomeInboxRooms(
  rooms: DiscussionInboxRoom[],
  cap = HOME_ROW_CAP,
): DiscussionInboxRoom[] {
  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);
  const remaining = Math.max(0, cap - pinned.length);
  return [...pinned, ...unpinned.slice(0, remaining)];
}

function DiscussionRoomRow({
  room,
  onTogglePin,
  pinDisabled,
}: {
  room: DiscussionInboxRoom;
  onTogglePin: (roomId: string) => void;
  pinDisabled?: boolean;
}) {
  const isBoard = room.room_id === "board";

  function handlePinClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (isBoard) {
      return;
    }
    onTogglePin(room.room_id);
  }

  return (
    <div className="group flex items-start gap-1 rounded-card p-1.5 transition duration-200 ease-out hover:bg-surface-muted">
      <Link to={discussionRoomPath(room.room_id)} className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
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
                className="text-[11px] font-normal tracking-[0.02em] text-gray-500"
              >
                {formatRelativeTimestamp(room.last_message_at)}
              </time>
            ) : null}
          </div>
        </div>
        {room.last_message_preview ? (
          <p className="mt-0.5 truncate text-xs font-normal text-gray-600">
            {room.last_message_author
              ? `${room.last_message_author}: ${room.last_message_preview}`
              : room.last_message_preview}
          </p>
        ) : null}
      </Link>
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
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
          room.pinned
            ? "text-primary hover:bg-badge-teal-bg"
            : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-surface-muted hover:text-foreground max-sm:opacity-100",
          pinDisabled || isBoard ? "cursor-default" : "",
          isBoard ? "opacity-100" : "",
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

export function DiscussionRoomList({
  rooms,
  onTogglePin,
  pinDisabled,
  showPinnedSection = true,
}: {
  rooms: DiscussionInboxRoom[];
  onTogglePin: (roomId: string) => void;
  pinDisabled?: boolean;
  showPinnedSection?: boolean;
}) {
  if (!showPinnedSection) {
    return (
      <ul className="space-y-0.5">
        {rooms.map((room) => (
          <li key={room.room_id}>
            <DiscussionRoomRow
              room={room}
              onTogglePin={onTogglePin}
              pinDisabled={pinDisabled}
            />
          </li>
        ))}
      </ul>
    );
  }

  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);

  return (
    <div className="space-y-2">
      {pinned.length > 0 ? (
        <div>
          <p className="px-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-gray-500">
            Pinned
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {pinned.map((room) => (
              <li key={room.room_id}>
                <DiscussionRoomRow
                  room={room}
                  onTogglePin={onTogglePin}
                  pinDisabled={pinDisabled}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {unpinned.length > 0 ? (
        <div>
          {pinned.length > 0 ? (
            <p className="px-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-gray-500">
              Recent
            </p>
          ) : null}
          <ul className="mt-0.5 space-y-0.5">
            {unpinned.map((room) => (
              <li key={room.room_id}>
                <DiscussionRoomRow
                  room={room}
                  onTogglePin={onTogglePin}
                  pinDisabled={pinDisabled}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function HomeDiscussionSection({
  previewLimit = HOME_ROW_CAP,
}: {
  previewLimit?: number;
}) {
  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinningId, setPinningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
      }
      try {
        const response = await fetchDiscussionInbox();
        if (!cancelled) {
          setRooms(response.rooms);
        }
      } catch {
        if (!cancelled && !opts?.silent) {
          setRooms([]);
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

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  async function handleTogglePin(roomId: string) {
    if (roomId === "board") {
      return;
    }
    const previous = rooms;
    setRooms((current) =>
      current.map((room) =>
        room.room_id === roomId
          ? {
              ...room,
              pinned: !room.pinned,
              pinned_at: room.pinned ? null : new Date().toISOString(),
            }
          : room,
      ),
    );
    setPinningId(roomId);
    try {
      const result = await toggleDiscussionRoomPin(roomId);
      setRooms((current) => {
        const next = current.map((room) =>
          room.room_id === result.room_id
            ? {
                ...room,
                pinned: result.pinned,
                pinned_at: result.pinned
                  ? (room.pinned_at ?? new Date().toISOString())
                  : null,
              }
            : room,
        );
        const pinned = next.filter((room) => room.pinned);
        const unpinned = next.filter((room) => !room.pinned);
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
      });
    } catch {
      setRooms(previous);
    } finally {
      setPinningId(null);
    }
  }

  const visible = selectHomeInboxRooms(rooms, previewLimit);

  if (loading) {
    return (
      <DiscussionCardShell>
        <p className="text-sm font-normal text-gray-600">Loading discussion…</p>
      </DiscussionCardShell>
    );
  }

  if (rooms.length === 0) {
    return (
      <DiscussionCardShell
        headerAction={<ArrowLink to={INBOX_PATH}>View all</ArrowLink>}
      >
        <p className="text-sm font-normal text-gray-600">No discussions yet</p>
      </DiscussionCardShell>
    );
  }

  return (
    <DiscussionCardShell
      headerAction={<ArrowLink to={INBOX_PATH}>View all</ArrowLink>}
    >
      <DiscussionRoomList
        rooms={visible}
        onTogglePin={handleTogglePin}
        pinDisabled={pinningId != null}
      />
    </DiscussionCardShell>
  );
}
