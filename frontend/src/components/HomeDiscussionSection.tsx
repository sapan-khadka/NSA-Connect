import { Hash, Megaphone, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import {
  fetchDiscussionInbox,
  type DiscussionInboxRoom,
} from "../lib/discussion-api";
import { discussionRoomPath } from "../lib/discussion-paths";
import { formatCompactRelativeTimestamp } from "../lib/format-datetime";
import {
  buildDiscussionAttentionItems,
  type DiscussionAttentionItem,
  type DiscussionRoomVisualKind,
} from "../lib/home-discussion-attention";
import { AppIcon } from "./ui/AppIcon";
import { ArrowLink } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";

const INBOX_PATH = "/discussions";
const INBOX_POLL_MS = 45_000;

function roomTypeIcon(kind: DiscussionRoomVisualKind) {
  if (kind === "board") {
    return Megaphone;
  }
  if (kind === "dm") {
    return User;
  }
  return Hash;
}

function totalUnread(rooms: DiscussionInboxRoom[]): number {
  return rooms.reduce((sum, room) => sum + Math.max(0, room.unread_count), 0);
}

function DiscussionCardShell({
  children,
  headerAction,
  unreadTotal = 0,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
  unreadTotal?: number;
}) {
  return (
    <HomeCard
      padding="sm"
      className="flex min-h-0 flex-col home-surface-quiet home-discussion-card"
      aria-label="Inbox"
    >
      <div className="home-discussion-head">
        <div className="home-discussion-head-title">
          <h2 className="home-panel-title">Inbox</h2>
          {unreadTotal > 0 ? (
            <span
              className="home-discussion-total"
              aria-label={`${unreadTotal} unread`}
            >
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
          ) : null}
        </div>
        {headerAction}
      </div>
      <div className="home-discussion-body">{children}</div>
    </HomeCard>
  );
}

function AttentionRow({ item }: { item: DiscussionAttentionItem }) {
  const { room, kind, roomKind, detail, badge } = item;
  const time = room.last_message_at
    ? formatCompactRelativeTimestamp(room.last_message_at)
    : null;
  const TypeIcon = roomTypeIcon(roomKind);
  const hasAttention = kind === "mentioned" || kind === "unread";

  return (
    <Link
      to={discussionRoomPath(room.room_id)}
      className={[
        "home-discussion-row home-discussion-row--feed",
        `is-${kind}`,
        hasAttention ? "has-attention" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="home-discussion-type" aria-hidden="true">
        <AppIcon icon={TypeIcon} size="xs" className="text-current" />
      </span>
      <div className="home-discussion-copy">
        <div className="home-discussion-title-row">
          <p className="home-discussion-title">{room.label}</p>
          <div className="home-discussion-title-meta">
            {badge ? (
              <span
                className="home-discussion-badge"
                aria-label={`${badge} unread`}
              >
                {badge}
              </span>
            ) : null}
            {time ? (
              <time
                dateTime={room.last_message_at ?? undefined}
                className="home-discussion-time"
              >
                {time}
              </time>
            ) : null}
          </div>
        </div>
        <p className="home-discussion-detail">{detail}</p>
      </div>
    </Link>
  );
}

export function HomeDiscussionSection({
  previewLimit = 5,
}: {
  previewLimit?: number;
}) {
  const { member } = useAuth();
  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let pollId: number | null = null;

    async function load(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await fetchDiscussionInbox();
        if (cancelled) {
          return;
        }
        setRooms(response.rooms);
        setError(null);
      } catch {
        if (cancelled) {
          return;
        }
        if (!opts?.silent) {
          setRooms([]);
          setError("Couldn’t load inbox");
        }
      } finally {
        if (!cancelled && !opts?.silent) {
          setLoading(false);
        }
      }
    }

    void load();
    pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }, INBOX_POLL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (pollId != null) {
        window.clearInterval(pollId);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const attention = buildDiscussionAttentionItems(rooms, {
    cap: previewLimit,
    viewerName: member?.full_name,
  });
  const unreadTotal = totalUnread(rooms);
  const openLink = <ArrowLink to={INBOX_PATH}>Open inbox →</ArrowLink>;

  if (loading) {
    return (
      <DiscussionCardShell headerAction={openLink}>
        <p className="home-discussion-empty">Loading inbox…</p>
      </DiscussionCardShell>
    );
  }

  if (error) {
    return (
      <DiscussionCardShell headerAction={openLink}>
        <p className="home-discussion-empty" role="alert">
          {error}
        </p>
      </DiscussionCardShell>
    );
  }

  if (rooms.length === 0) {
    return (
      <DiscussionCardShell headerAction={openLink}>
        <p className="home-discussion-empty">No messages yet</p>
      </DiscussionCardShell>
    );
  }

  if (attention.length === 0) {
    return (
      <DiscussionCardShell headerAction={openLink} unreadTotal={unreadTotal}>
        <p className="home-discussion-empty">You’re caught up</p>
      </DiscussionCardShell>
    );
  }

  return (
    <DiscussionCardShell headerAction={openLink} unreadTotal={unreadTotal}>
      <ul className="home-discussion-list home-discussion-list--feed">
        {attention.map((item) => (
          <li key={item.room.room_id}>
            <AttentionRow item={item} />
          </li>
        ))}
      </ul>
    </DiscussionCardShell>
  );
}
