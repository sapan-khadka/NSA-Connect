import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";

import { useDiscussionInbox } from "../context/DiscussionInboxProvider";
import type { DiscussionInboxRoom } from "../lib/discussion-api";
import { sortDiscussionInboxRooms } from "../lib/discussion-inbox";
import {
  DiscussionInboxRow,
  DiscussionInboxSectionLabel,
  groupDiscussionInboxRooms,
} from "./discussions/DiscussionInboxRow";
import { ArrowLink } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";

const INBOX_PATH = "/discussions";

function totalUnread(rooms: DiscussionInboxRoom[]): number {
  return rooms.reduce((sum, room) => sum + Math.max(0, room.unread_count), 0);
}

function DiscussionCardShell({
  children,
  headerAction,
  unreadTotal = 0,
  variant = "card",
}: {
  children: ReactNode;
  headerAction?: ReactNode;
  unreadTotal?: number;
  variant?: "card" | "rail";
}) {
  if (variant === "rail") {
    return (
      <div className="home-discussion-rail" aria-label="Inbox threads">
        <div className="home-discussion-rail__list">{children}</div>
      </div>
    );
  }

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

function InboxRoomSections({
  rooms,
  previewLimit,
}: {
  rooms: DiscussionInboxRoom[];
  previewLimit: number;
}) {
  const ordered = useMemo(
    () => sortDiscussionInboxRooms(rooms),
    [rooms],
  );
  const groups = useMemo(
    () => groupDiscussionInboxRooms(ordered),
    [ordered],
  );

  const capped = useMemo(() => {
    const pick: DiscussionInboxRoom[] = [];
    for (const room of [
      ...groups.pinned,
      ...groups.channels,
      ...groups.directMessages,
    ]) {
      if (pick.length >= previewLimit) break;
      pick.push(room);
    }
    const ids = new Set(pick.map((r) => r.room_id));
    return {
      pinned: groups.pinned.filter((r) => ids.has(r.room_id)),
      channels: groups.channels.filter((r) => ids.has(r.room_id)),
      directMessages: groups.directMessages.filter((r) => ids.has(r.room_id)),
    };
  }, [groups, previewLimit]);

  return (
    <div className="home-discussion-sections">
      {capped.pinned.length > 0 ? (
        <section className="home-discussion-section">
          <DiscussionInboxSectionLabel>Pinned</DiscussionInboxSectionLabel>
          {capped.pinned.map((room) => (
            <DiscussionInboxRow
              key={room.room_id}
              room={room}
              asLink
              pinInteractive={false}
            />
          ))}
        </section>
      ) : null}

      {capped.channels.length > 0 ? (
        <section className="home-discussion-section">
          <DiscussionInboxSectionLabel>Channels</DiscussionInboxSectionLabel>
          {capped.channels.map((room) => (
            <DiscussionInboxRow
              key={room.room_id}
              room={room}
              asLink
              pinInteractive={false}
            />
          ))}
        </section>
      ) : null}

      {capped.directMessages.length > 0 ? (
        <section className="home-discussion-section">
          <DiscussionInboxSectionLabel>
            Direct Messages
          </DiscussionInboxSectionLabel>
          {capped.directMessages.map((room) => (
            <DiscussionInboxRow
              key={room.room_id}
              room={room}
              asLink
              pinInteractive={false}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

export function HomeDiscussionSection({
  previewLimit = 5,
  variant = "card",
}: {
  previewLimit?: number;
  variant?: "card" | "rail";
}) {
  const { rooms, loading, error } = useDiscussionInbox();

  const unreadTotal = totalUnread(rooms);
  const openLink =
    variant === "rail" ? undefined : (
      <ArrowLink to={INBOX_PATH}>Open</ArrowLink>
    );

  if (loading) {
    return (
      <DiscussionCardShell headerAction={openLink} variant={variant}>
        <p className="home-discussion-empty">Loading…</p>
      </DiscussionCardShell>
    );
  }

  if (error) {
    return (
      <DiscussionCardShell headerAction={openLink} variant={variant}>
        <p className="home-discussion-empty" role="alert">
          Couldn’t load inbox
        </p>
      </DiscussionCardShell>
    );
  }

  if (rooms.length === 0) {
    return (
      <DiscussionCardShell headerAction={openLink} variant={variant}>
        <p className="home-discussion-empty">No conversations yet</p>
      </DiscussionCardShell>
    );
  }

  return (
    <DiscussionCardShell
      headerAction={openLink}
      unreadTotal={unreadTotal}
      variant={variant}
    >
      <InboxRoomSections rooms={rooms} previewLimit={previewLimit} />
      {variant === "card" ? (
        <div className="home-discussion-card-footer">
          <Link to={INBOX_PATH} className="ds-link text-sm">
            Open all discussions
          </Link>
        </div>
      ) : null}
    </DiscussionCardShell>
  );
}
