import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  CircleDot,
  Lightbulb,
  BarChart3,
  Globe2,
  XCircle,
  Archive,
} from "lucide-react";

import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";
import { getApiErrorMessage } from "../lib/api-error";
import {
  closeIdeaPoll,
  createIdeaPoll,
  fetchIdeaActivity,
  fetchIdeaPolls,
  voteIdeaPoll,
  type IdeaActivityItem,
  type IdeaPoll,
} from "../lib/event-suggestion-polish-api";
import type { EventSuggestion } from "../lib/event-suggestions-api";
import {
  feedbackEndsShortLabel,
  ideaTimelineNowLabel,
} from "../lib/idea-workspace-metrics";
import { fieldLabelClassName } from "../design-system/components/fieldStyles";

function toSentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatTimelineDay(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return "";
  const date = new Date(parsed);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const dayDiff = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

const ACTIVITY_PREVIEW_LIMIT = 6;

type TimelineRow = IdeaActivityItem & { isNow?: boolean };

function timelineIcon(item: TimelineRow) {
  if (item.isNow) return CircleDot;
  const summary = item.summary.toLowerCase();
  if (item.kind === "created" || summary.includes("submitted")) return Lightbulb;
  if (item.kind === "poll" || summary.includes("poll")) return BarChart3;
  if (summary.includes("feedback opened") || summary.includes("published")) {
    return Globe2;
  }
  if (
    summary.includes("approved") ||
    summary.includes("converted") ||
    summary.includes("scheduled")
  ) {
    return CalendarCheck2;
  }
  if (summary.includes("rejected")) return XCircle;
  if (summary.includes("archived")) return Archive;
  if (summary.includes("closed") || summary.includes("review")) {
    return CheckCircle2;
  }
  return CheckCircle2;
}

export function IdeaCreatePollForm({
  suggestionId,
  onCreated,
  onCancel,
}: {
  suggestionId: number;
  onCreated: (poll: IdeaPoll) => void;
  onCancel?: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("Spring\nFall\nSummer");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const options = optionsText
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean);
    if (!question.trim() || options.length < 2) {
      setErrorMessage("Add a question and at least two options.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      onCreated(
        await createIdeaPoll(suggestionId, {
          question: question.trim(),
          options,
        }),
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void handleCreate(e)}>
      <label className="block">
        <span className={fieldLabelClassName}>Question</span>
        <input
          type="text"
          className={`${inputFieldClassName} mt-1`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Preferred semester?"
          disabled={saving}
        />
      </label>
      <label className="block">
        <span className={fieldLabelClassName}>Options (one per line)</span>
        <textarea
          className={`${inputFieldClassName} mt-1`}
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          rows={3}
          disabled={saving}
        />
      </label>
      {errorMessage ? (
        <p className="ds-field-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            className="text-sm font-medium text-label transition hover:text-foreground disabled:opacity-60"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
        <Button type="submit" size="sm" loading={saving} disabled={saving}>
          Create poll
        </Button>
      </div>
    </form>
  );
}

export function IdeaActivitySection({
  suggestionId,
  idea,
}: {
  suggestionId: number;
  idea: EventSuggestion;
}) {
  const [items, setItems] = useState<IdeaActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchIdeaActivity(suggestionId)
      .then((activity) => {
        if (!cancelled) setItems(activity);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [suggestionId]);

  const chronological = [...items].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
  const timeline: TimelineRow[] = [
    ...chronological,
    {
      kind: "status",
      summary: ideaTimelineNowLabel(idea),
      created_at: new Date().toISOString(),
      actor: null,
      isNow: true,
    },
  ];
  const visibleItems =
    expanded || timeline.length <= ACTIVITY_PREVIEW_LIMIT
      ? timeline
      : [
          ...timeline.slice(0, ACTIVITY_PREVIEW_LIMIT - 1),
          timeline[timeline.length - 1],
        ];
  const hasMore = timeline.length > ACTIVITY_PREVIEW_LIMIT;

  return (
    <Card
      padding="none"
      className="idea-ws-card"
      aria-labelledby="idea-timeline"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="idea-timeline"
          className="text-sm font-semibold uppercase tracking-wide text-label"
        >
          Timeline
        </h2>
        {!loading && chronological.length > 0 ? (
          <p className="text-xs text-label">
            {chronological.length}{" "}
            {chronological.length === 1 ? "milestone" : "milestones"}
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        {loading ? (
          <p className="text-sm text-label">Loading…</p>
        ) : (
          <ol className="idea-timeline">
            {visibleItems.map((item, index) => {
              const isLast = index === visibleItems.length - 1;
              const Icon = timelineIcon(item);
              return (
                <li
                  key={`${item.kind}-${item.created_at}-${index}`}
                  className={[
                    "idea-timeline__item",
                    item.isNow ? "is-current" : "",
                    `is-kind-${item.kind}`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="idea-timeline__rail" aria-hidden="true">
                    <span className="idea-timeline__icon">
                      <Icon className="idea-timeline__glyph" />
                    </span>
                    {!isLast ? <span className="idea-timeline__line" /> : null}
                  </div>
                  <div className="idea-timeline__body">
                    <div className="idea-timeline__when-row">
                      {item.isNow ? (
                        <span className="idea-timeline__progress-pill">
                          <span
                            className="idea-timeline__progress-dot"
                            aria-hidden="true"
                          />
                          In progress
                        </span>
                      ) : (
                        <p className="idea-timeline__when">
                          {formatTimelineDay(item.created_at)}
                        </p>
                      )}
                    </div>
                    <p className="idea-timeline__summary">{item.summary}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {hasMore ? (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-label hover:text-foreground hover:underline"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? "Show less"
              : `View full timeline (${timeline.length}) →`}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

function PollBlock({
  poll,
  suggestionId,
  canManage,
  saving,
  expanded,
  endsLabel,
  eligibleCount,
  onToggle,
  onSaving,
  onVoted,
  onClosed,
  onError,
}: {
  poll: IdeaPoll;
  suggestionId: number;
  canManage: boolean;
  saving: boolean;
  expanded: boolean;
  endsLabel: string | null;
  eligibleCount: number | null;
  onToggle: () => void;
  onSaving: (value: boolean) => void;
  onVoted: (updated: IdeaPoll) => void;
  onClosed: (updated: IdeaPoll) => void;
  onError: (message: string) => void;
}) {
  const leading = toSentenceCase(poll.question);

  return (
    <div className="rounded-lg border border-gray-100">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            <span className="mr-1.5 text-label" aria-hidden="true">
              {expanded ? "▼" : "▶"}
            </span>
            {leading}
          </span>
          <span className="idea-poll-meta">
            <span>
              {eligibleCount != null && eligibleCount > 0
                ? `${poll.total_votes} / ${eligibleCount} members`
                : `${poll.total_votes} ${poll.total_votes === 1 ? "vote" : "votes"}`}
            </span>
            <span>{poll.is_open ? "Open" : "Closed"}</span>
            {poll.is_open && endsLabel ? <span>{endsLabel}</span> : null}
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-gray-100 px-3 py-3">
          <ul
            className="idea-result-bars"
            role="radiogroup"
            aria-label={poll.question}
          >
            {poll.options.map((option) => {
              const selected = poll.my_option_id === option.id;
              const pct =
                poll.total_votes > 0
                  ? Math.round((option.vote_count / poll.total_votes) * 100)
                  : 0;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={[
                      "idea-result-bars__row",
                      "is-clickable",
                      selected ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={!poll.is_open || saving}
                    onClick={() => {
                      onSaving(true);
                      void voteIdeaPoll(suggestionId, poll.id, option.id)
                        .then(onVoted)
                        .catch((error) => {
                          onSaving(false);
                          onError(getApiErrorMessage(error));
                        });
                    }}
                  >
                    <span className="idea-result-bars__label">
                      {option.label}
                    </span>
                    <span className="idea-result-bars__track" aria-hidden="true">
                      <span
                        className="idea-result-bars__fill is-poll"
                        style={{
                          width: `${Math.max(pct, option.vote_count > 0 ? 4 : 0)}%`,
                        }}
                      />
                    </span>
                    <span className="idea-result-bars__count">
                      {option.vote_count}
                      {poll.total_votes > 0 ? (
                        <span className="idea-result-bars__pct"> ({pct}%)</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-label">
            {poll.my_option_id != null ? "Your vote recorded" : "No vote yet"}
            {!poll.is_open ? " · closed" : ""}
          </p>
          {canManage && poll.is_open ? (
            <button
              type="button"
              className="text-sm font-medium text-label hover:text-foreground hover:underline disabled:opacity-60"
              disabled={saving}
              onClick={() => {
                onSaving(true);
                void closeIdeaPoll(suggestionId, poll.id)
                  .then(onClosed)
                  .catch((error) => {
                    onSaving(false);
                    onError(getApiErrorMessage(error));
                  });
              }}
            >
              Close poll
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function IdeaPollSection({
  suggestionId,
  canManage,
  idea,
  onPresenceChange,
  embedded = false,
}: {
  suggestionId: number;
  canManage: boolean;
  idea?: EventSuggestion | null;
  onPresenceChange?: (hasPoll: boolean) => void;
  embedded?: boolean;
}) {
  const [polls, setPolls] = useState<IdeaPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openPollId, setOpenPollId] = useState<number | null>(null);
  const endsLabel = idea ? feedbackEndsShortLabel(idea) : null;
  const eligibleCount = idea?.eligible_member_count ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetchIdeaPolls(suggestionId)
      .then((next) => {
        if (!cancelled) {
          setPolls(next);
          onPresenceChange?.(next.length > 0);
          setOpenPollId((current) => {
            if (current != null && next.some((poll) => poll.id === current)) {
              return current;
            }
            return next[0]?.id ?? null;
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPolls([]);
          onPresenceChange?.(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [suggestionId, onPresenceChange]);

  function replacePoll(updated: IdeaPoll) {
    setPolls((current) =>
      current.map((poll) => (poll.id === updated.id ? updated : poll)),
    );
  }

  if (loading) return null;
  if (polls.length === 0 && !canManage) {
    return embedded ? null : null;
  }

  const body = (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {embedded ? (
          <h3
            id="idea-poll"
            className="text-xs font-semibold uppercase tracking-wide text-label"
          >
            Polls
          </h3>
        ) : (
          <h2
            id="idea-poll"
            className="text-sm font-semibold uppercase tracking-wide text-label"
          >
            Polls
          </h2>
        )}
        {canManage && !creating ? (
          <button
            type="button"
            className="text-sm font-medium text-label hover:text-foreground hover:underline"
            onClick={() => setCreating(true)}
          >
            + Add poll
          </button>
        ) : null}
      </div>

      <div className={embedded ? "mt-2 space-y-2" : "mt-3 space-y-2"}>
        {polls.length === 0 && !creating ? (
          <p className="text-sm text-label">No polls yet.</p>
        ) : null}

        {polls.map((poll) => (
          <PollBlock
            key={poll.id}
            poll={poll}
            suggestionId={suggestionId}
            canManage={canManage}
            saving={saving}
            expanded={openPollId === poll.id}
            endsLabel={endsLabel}
            eligibleCount={eligibleCount}
            onToggle={() =>
              setOpenPollId((current) =>
                current === poll.id ? null : poll.id,
              )
            }
            onSaving={setSaving}
            onVoted={(updated) => {
              setSaving(false);
              setErrorMessage(null);
              replacePoll(updated);
            }}
            onClosed={(updated) => {
              setSaving(false);
              setErrorMessage(null);
              replacePoll(updated);
            }}
            onError={(message) => {
              setErrorMessage(message);
            }}
          />
        ))}

        {creating ? (
          <div className="border-t border-gray-100 pt-3">
            <IdeaCreatePollForm
              suggestionId={suggestionId}
              onCancel={() => setCreating(false)}
              onCreated={(poll) => {
                setPolls((current) => [...current, poll]);
                setOpenPollId(poll.id);
                onPresenceChange?.(true);
                setCreating(false);
              }}
            />
          </div>
        ) : null}

        {errorMessage ? (
          <p className="ds-field-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return <section aria-labelledby="idea-poll">{body}</section>;
  }

  return (
    <Card padding="none" className="idea-ws-card" aria-labelledby="idea-poll">
      {body}
    </Card>
  );
}
