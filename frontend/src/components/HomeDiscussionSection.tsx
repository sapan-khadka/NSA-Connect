import { MessagesSquare } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import {
  fetchBoardDiscussion,
  type DiscussionMessage,
} from "../lib/discussion-api";
import { formatRelativeTimestamp } from "../lib/format-datetime";
import { isRoleAtLeast } from "../lib/roles";
import { ArrowLink } from "./ui/ArrowLink";
import { HomeCard } from "./ui/HomeCard";
import { IconBadge } from "./ui/IconBadge";

const BOARD_DISCUSSION_PATH = "/board/discussion";

function DiscussionCardShell({
  children,
  headerAction,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    <HomeCard padding="sm" className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="ds-icon-label">
          <IconBadge icon={MessagesSquare} category="members" size="sm" />
          <h2 className="text-lg font-semibold text-foreground">Discussion</h2>
        </div>
        {headerAction}
      </div>
      <div className="mt-3 flex flex-col">{children}</div>
    </HomeCard>
  );
}

function previewText(content: string): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 120) {
    return singleLine;
  }
  return `${singleLine.slice(0, 117).trimEnd()}…`;
}

function DiscussionPreviewRow({ message }: { message: DiscussionMessage }) {
  return (
    <Link
      to={BOARD_DISCUSSION_PATH}
      className="group block rounded-card p-1.5 transition duration-200 ease-out hover:bg-surface-muted"
    >
      <p className="truncate text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
        {previewText(message.content)}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-normal text-gray-500">
        <span className="truncate font-medium text-gray-600">
          {message.author.full_name}
        </span>
        <span className="text-gray-300" aria-hidden="true">
          ·
        </span>
        <time
          dateTime={message.created_at}
          className="tracking-[0.02em] text-gray-500"
        >
          {formatRelativeTimestamp(message.created_at)}
        </time>
      </div>
    </Link>
  );
}

export function HomeDiscussionSection({
  previewLimit = 3,
}: {
  previewLimit?: number;
}) {
  const { member } = useAuth();
  const canAccessBoardDiscussion = member
    ? isRoleAtLeast(member.role, "board")
    : false;
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [loading, setLoading] = useState(canAccessBoardDiscussion);

  useEffect(() => {
    if (!canAccessBoardDiscussion) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetchBoardDiscussion({ limit: previewLimit });
        if (!cancelled) {
          // API returns chronological (oldest → newest); show newest first.
          setMessages([...response.messages].reverse().slice(0, previewLimit));
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [canAccessBoardDiscussion, previewLimit]);

  if (loading) {
    return (
      <DiscussionCardShell>
        <p className="text-sm font-normal text-gray-600">Loading discussion…</p>
      </DiscussionCardShell>
    );
  }

  if (!canAccessBoardDiscussion) {
    return (
      <DiscussionCardShell>
        <p className="text-sm font-normal text-gray-600">
          Board discussion is available to board members. Event chats live on
          each event page when you volunteer.
        </p>
      </DiscussionCardShell>
    );
  }

  if (messages.length === 0) {
    return (
      <DiscussionCardShell
        headerAction={
          <ArrowLink to={BOARD_DISCUSSION_PATH}>View all</ArrowLink>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-normal text-gray-600">
            No messages yet. Start the board conversation.
          </p>
          <Link
            to={BOARD_DISCUSSION_PATH}
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-badge-teal-bg px-3 py-1.5 text-sm font-medium text-primary transition duration-200 hover:bg-badge-teal-bg/80"
          >
            Start a discussion
          </Link>
        </div>
      </DiscussionCardShell>
    );
  }

  return (
    <DiscussionCardShell
      headerAction={<ArrowLink to={BOARD_DISCUSSION_PATH}>View all</ArrowLink>}
    >
      <ul className="space-y-0.5">
        {messages.map((message) => (
          <li key={message.id}>
            <DiscussionPreviewRow message={message} />
          </li>
        ))}
      </ul>
    </DiscussionCardShell>
  );
}
