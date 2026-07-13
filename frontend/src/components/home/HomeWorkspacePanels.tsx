import { MessageSquare, Megaphone, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  fetchAnnouncements,
  type Announcement,
} from "../../lib/announcements-api";
import {
  fetchDiscussionInbox,
  toggleDiscussionRoomPin,
  type DiscussionInboxRoom,
} from "../../lib/discussion-api";
import { formatRelativeTimestamp } from "../../lib/format-datetime";
import { DiscussionRoomList, selectHomeInboxRooms } from "../HomeDiscussionSection";
import { ArrowLink } from "../ui/ArrowLink";
import { HomeCard } from "../ui/HomeCard";
import { IconBadge } from "../ui/IconBadge";

const AI_SUGGESTIONS = [
  {
    id: "minutes",
    label: "Generate meeting minutes",
    prompt: "Help me draft meeting minutes for our last board meeting.",
  },
  {
    id: "announce",
    label: "Draft announcement",
    prompt: "Draft a short announcement for an upcoming cultural event.",
  },
  {
    id: "finance",
    label: "Summarize finances",
    prompt: "Summarize our current budget and recent treasury activity.",
  },
  {
    id: "plan",
    label: "Plan an event",
    prompt: "Help me plan a checklist for our next cultural event.",
  },
] as const;

/**
 * Board Feed — pinned discussion + latest announcements (summaries only).
 */
export function HomeBoardFeed({ previewLimit = 3 }: { previewLimit?: number }) {
  const [rooms, setRooms] = useState<DiscussionInboxRoom[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [pinningId, setPinningId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiscussions(opts?: { silent?: boolean }) {
      if (!opts?.silent) {
        setLoadingDiscussions(true);
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
          setLoadingDiscussions(false);
        }
      }
    }

    void loadDiscussions();
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadDiscussions({ silent: true });
      }
    }, 12_000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchAnnouncements()
      .then((response) => {
        if (!cancelled) {
          setAnnouncements(response.announcements.slice(0, previewLimit));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnnouncements([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingAnnouncements(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewLimit]);

  async function handleTogglePin(roomId: string) {
    if (roomId === "board") {
      return;
    }
    setPinningId(roomId);
    try {
      const result = await toggleDiscussionRoomPin(roomId);
      setRooms((current) =>
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
      );
    } catch {
      /* keep prior state */
    } finally {
      setPinningId(null);
    }
  }

  const previewRooms = selectHomeInboxRooms(rooms, previewLimit);
  const loading = loadingDiscussions || loadingAnnouncements;

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="Board Feed"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="ds-icon-label">
          <IconBadge icon={MessageSquare} category="announcements" size="sm" />
          <h2 className="home-section-title">Board Feed</h2>
        </div>
        <ArrowLink to="/discussions">View all</ArrowLink>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
        {loading ? (
          <p className="text-sm text-gray-600">Loading feed…</p>
        ) : null}

        {!loading ? (
          <section>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-gray-500">
              Discussions
            </p>
            {previewRooms.length === 0 ? (
              <p className="text-sm text-gray-600">No discussions yet.</p>
            ) : (
              <DiscussionRoomList
                rooms={previewRooms}
                onTogglePin={(id) => void handleTogglePin(id)}
                pinDisabled={pinningId !== null}
              />
            )}
          </section>
        ) : null}

        {!loading ? (
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-gray-500">
                Updates
              </p>
              <Link
                to="/announcements"
                className="text-xs font-medium text-primary hover:text-primary-hover"
              >
                All updates
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-600">No announcements yet.</p>
            ) : (
              <ul className="space-y-2">
                {announcements.map((announcement) => (
                  <li key={announcement.id}>
                    <Link
                      to="/announcements"
                      className="block rounded-lg px-1.5 py-1.5 transition hover:bg-surface-muted"
                    >
                      <div className="flex items-start gap-2">
                        <AppIconBadge />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {announcement.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category]}
                            {" · "}
                            {formatRelativeTimestamp(announcement.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </HomeCard>
  );
}

function AppIconBadge() {
  return (
    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-badge-teal-bg text-primary">
      <Megaphone className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

/**
 * CampusOS AI — suggestion chips + compact prompt (navigates to /assistant).
 */
export function HomeCampusAiCard() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");

  function goWithPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) {
      navigate("/assistant");
      return;
    }
    navigate(`/assistant?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    goWithPrompt(draft);
  }

  return (
    <HomeCard
      padding="sm"
      className="flex h-full min-h-0 flex-col home-surface-quiet"
      aria-label="CampusOS AI"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="ds-icon-label">
          <IconBadge icon={Sparkles} category="tasks" size="sm" />
          <h2 className="home-section-title">CampusOS AI</h2>
        </div>
        <ArrowLink to="/assistant">Open</ArrowLink>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        Suggestions to move work forward — open the assistant for full answers.
      </p>

      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AI_SUGGESTIONS.map((suggestion) => (
          <li key={suggestion.id}>
            <button
              type="button"
              onClick={() => goWithPrompt(suggestion.prompt)}
              className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-left text-sm font-medium text-foreground shadow-sm transition hover:border-gray-200 hover:shadow-md"
            >
              {suggestion.label}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="mt-auto pt-3">
        <label htmlFor="campusos-ai-prompt" className="sr-only">
          Ask CampusOS AI
        </label>
        <div className="flex gap-2">
          <input
            id="campusos-ai-prompt"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask anything…"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-foreground placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
          >
            Ask
          </button>
        </div>
      </form>
    </HomeCard>
  );
}
