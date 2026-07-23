import { Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  fetchDiscussionInbox,
  type DiscussionInboxRoom,
} from "../lib/discussion-api";
import { discussionRoomPath } from "../lib/discussion-paths";
import { formatRelativeTimestamp } from "../lib/format-datetime";
import { ArrowLink } from "./ui/ArrowLink";
import { AppIcon } from "./ui/AppIcon";
import { HomeCard } from "./ui/HomeCard";

const INBOX_PATH = "/discussions";
const INBOX_POLL_MS = 12_000;

function DiscussionCardShell({
  children,
  headerAction,
  footer,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="Discussions"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h2 className="home-panel-title">Discussions</h2>
        {headerAction}
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {children}
      </div>
      {footer}
    </HomeCard>
  );
}

export function selectHomeInboxRooms(
  rooms: DiscussionInboxRoom[],
  cap = 6,
): DiscussionInboxRoom[] {
  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);
  const remaining = Math.max(0, cap - pinned.length);
  return [...pinned, ...unpinned.slice(0, remaining)];
}

function DiscussionRoomRow({ room }: { room: DiscussionInboxRoom }) {
  return (
    <Link to={discussionRoomPath(room.room_id)} className="home-discussion-row">
      <div className="home-discussion-copy">
        <div className="home-discussion-title-row">
          <p className="home-discussion-title">{room.label}</p>
          {room.unread_display ? (
            <span className="home-discussion-unread">{room.unread_display}</span>
          ) : room.unread_count > 0 ? (
            <span className="home-discussion-dot" aria-hidden="true" />
          ) : null}
        </div>
        {room.last_message_preview ? (
          <p className="home-discussion-preview">
            {room.last_message_author
              ? `${room.last_message_author}: ${room.last_message_preview}`
              : room.last_message_preview}
          </p>
        ) : (
          <p className="home-discussion-preview">No messages yet</p>
        )}
      </div>
      {room.last_message_at ? (
        <time dateTime={room.last_message_at} className="home-discussion-time">
          {formatRelativeTimestamp(room.last_message_at)}
        </time>
      ) : null}
    </Link>
  );
}

function DiscussionSection({
  title,
  rooms,
}: {
  title: string;
  rooms: DiscussionInboxRoom[];
}) {
  if (rooms.length === 0) {
    return null;
  }
  return (
    <div className="home-discussion-group">
      <p className="home-discussion-group-title">{title}</p>
      <ul className="home-discussion-list">
        {rooms.map((room) => (
          <li key={room.room_id}>
            <DiscussionRoomRow room={room} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DiscussionRoomList({
  rooms,
  onTogglePin: _onTogglePin,
  pinDisabled: _pinDisabled,
  showPinnedSection = true,
}: {
  rooms: DiscussionInboxRoom[];
  onTogglePin: (roomId: string) => void;
  pinDisabled?: boolean;
  showPinnedSection?: boolean;
}) {
  void _onTogglePin;
  void _pinDisabled;

  if (!showPinnedSection) {
    const pinned = rooms.filter((room) => room.pinned);
    const unread = rooms.filter(
      (room) => !room.pinned && room.unread_count > 0,
    );
    const recent = rooms.filter(
      (room) => !room.pinned && room.unread_count <= 0,
    );
    return (
      <div className="home-discussion-groups">
        <DiscussionSection title="Pinned" rooms={pinned} />
        <DiscussionSection title="Unread" rooms={unread} />
        <DiscussionSection title="Recent" rooms={recent} />
      </div>
    );
  }

  const pinned = rooms.filter((room) => room.pinned);
  const unpinned = rooms.filter((room) => !room.pinned);
  return (
    <div className="home-discussion-groups">
      <DiscussionSection title="Pinned" rooms={pinned} />
      <DiscussionSection title="Recent" rooms={unpinned} />
    </div>
  );
}

export function HomeDiscussionSection({
  previewLimit = 8,
}: {
  previewLimit?: number;
}) {
  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [loading, setLoading] = useState(true);

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

  const visible = selectHomeInboxRooms(rooms, previewLimit);
  const footer = (
    <div className="home-panel-footer">
      <Link to={INBOX_PATH} className="home-panel-footer-link">
        <AppIcon icon={Plus} size="xs" className="text-current" />
        Start new discussion
      </Link>
    </div>
  );

  if (loading) {
    return (
      <DiscussionCardShell footer={footer}>
        <p className="text-sm font-normal text-gray-600">Loading discussion…</p>
      </DiscussionCardShell>
    );
  }

  if (rooms.length === 0) {
    return (
      <DiscussionCardShell
        headerAction={<ArrowLink to={INBOX_PATH}>Open inbox</ArrowLink>}
        footer={footer}
      >
        <p className="text-sm font-normal text-gray-600">No discussions yet</p>
      </DiscussionCardShell>
    );
  }

  return (
    <DiscussionCardShell
      headerAction={<ArrowLink to={INBOX_PATH}>Open inbox</ArrowLink>}
      footer={footer}
    >
      <DiscussionRoomList
        rooms={visible}
        onTogglePin={() => undefined}
        showPinnedSection
      />
    </DiscussionCardShell>
  );
}
