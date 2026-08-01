import { Plus, Search, SlidersHorizontal } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useNavigate } from "react-router";

import { AppIcon } from "../components/ui/AppIcon";
import { Button } from "../components/ui/Button";
import { inputFieldClassName } from "../components/ui/Input";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import {
  createEventSuggestion,
  fetchEventSuggestions,
  IDEA_STATUS_LABEL,
  markEventSuggestionNoted,
  type EventSuggestion,
  type EventSuggestionStatus,
} from "../lib/event-suggestions-api";
import { isRoleAtLeast } from "../lib/roles";

const TIMING_SUGGESTIONS = [
  "This semester",
  "Next semester",
  "Fall",
  "Spring",
] as const;

type StatusFilter = "all" | EventSuggestionStatus;
type SortOption = "newest" | "oldest" | "title";

function formatShortDate(isoDate: string): string {
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function IdeaRow({
  suggestion,
  canManage,
  onReviewed,
}: {
  suggestion: EventSuggestion;
  canManage: boolean;
  onReviewed: (updated: EventSuggestion) => void;
}) {
  const navigate = useNavigate();
  const [marking, setMarking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isPending = suggestion.status === "submitted";
  const timing = suggestion.preferred_timing?.trim() || "Any semester";
  const when = formatShortDate(suggestion.created_at);
  const href = `/events/ideas/${suggestion.id}`;

  async function handleOpenDiscussion(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMarking(true);
    setErrorMessage(null);
    try {
      const updated = await markEventSuggestionNoted(suggestion.id);
      onReviewed(updated);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setMarking(false);
    }
  }

  function openIdea() {
    navigate(href);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openIdea();
    }
  }

  return (
    <li>
      <article
        className={[
          "ideas-row",
          "is-link",
          isPending ? "" : "is-reviewed",
        ]
          .filter(Boolean)
          .join(" ")}
        role="link"
        tabIndex={0}
        aria-label={`Open idea: ${suggestion.title}`}
        onClick={openIdea}
        onKeyDown={handleRowKeyDown}
      >
        <div className="ideas-row__top">
          <h2 className="ideas-row__title">{suggestion.title}</h2>
          <div className="ideas-row__actions">
            <span
              className={[
                "ideas-row__status",
                `is-${suggestion.status}`,
              ].join(" ")}
            >
              {IDEA_STATUS_LABEL[suggestion.status]}
            </span>
            {canManage && isPending ? (
              <button
                type="button"
                className="ideas-row__action"
                disabled={marking}
                onClick={(event) => void handleOpenDiscussion(event)}
              >
                {marking ? "Saving…" : "Start review"}
              </button>
            ) : null}
          </div>
        </div>

        {suggestion.description.trim() ? (
          <p className="ideas-row__desc">{suggestion.description.trim()}</p>
        ) : null}

        <p className="ideas-row__meta">
          <span>{timing}</span>
          <span className="ideas-row__sep" aria-hidden="true">
            ·
          </span>
          <span>{suggestion.suggested_by.full_name}</span>
          {when ? (
            <>
              <span className="ideas-row__sep" aria-hidden="true">
                ·
              </span>
              <span>{when}</span>
            </>
          ) : null}
          {suggestion.interest_counts.interested > 0 ? (
            <>
              <span className="ideas-row__sep" aria-hidden="true">
                ·
              </span>
              <span>
                {suggestion.interest_counts.interested} would attend
              </span>
            </>
          ) : null}
          {suggestion.view_count > 0 ? (
            <>
              <span className="ideas-row__sep" aria-hidden="true">
                ·
              </span>
              <span>
                {suggestion.view_count}{" "}
                {suggestion.view_count === 1 ? "view" : "views"}
              </span>
            </>
          ) : null}
        </p>

        {errorMessage ? (
          <p className="ideas-row__error" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </article>
    </li>
  );
}

export function EventSuggestionsPage() {
  const { member } = useAuth();
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preferredTiming, setPreferredTiming] = useState("");
  const [customTiming, setCustomTiming] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const canManage = member ? isRoleAtLeast(member.role, "board") : false;
  const moreFiltersActive = semesterFilter !== "all";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchEventSuggestions();
        if (!cancelled) {
          setSuggestions(response.suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error));
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
  }, []);

  const stats = useMemo(() => {
    const total = suggestions.length;
    const inDiscussion = suggestions.filter(
      (row) => row.status === "internal_review",
    ).length;
    const pending = suggestions.filter(
      (row) => row.status === "submitted",
    ).length;
    return { total, inDiscussion, pending };
  }, [suggestions]);

  const semesterOptions = useMemo(() => {
    const values = new Set<string>();
    for (const suggestion of suggestions) {
      const timing = suggestion.preferred_timing?.trim();
      if (timing) {
        values.add(timing);
      }
    }
    return [...values].sort((left, right) => left.localeCompare(right));
  }, [suggestions]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = suggestions.filter((suggestion) => {
      if (statusFilter !== "all" && suggestion.status !== statusFilter) {
        return false;
      }
      if (semesterFilter !== "all") {
        const timing = suggestion.preferred_timing?.trim() || "";
        if (timing !== semesterFilter) {
          return false;
        }
      }
      if (!query) {
        return true;
      }
      const haystack =
        `${suggestion.title} ${suggestion.description} ${suggestion.suggested_by.full_name}`.toLowerCase();
      return haystack.includes(query);
    });

    rows.sort((left, right) => {
      if (sort === "title") {
        return left.title.localeCompare(right.title);
      }
      const leftMs = Date.parse(left.created_at);
      const rightMs = Date.parse(right.created_at);
      if (sort === "oldest") {
        return leftMs - rightMs;
      }
      return rightMs - leftMs;
    });

    return rows;
  }, [suggestions, search, statusFilter, semesterFilter, sort]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setSubmitError("Title and description are required.");
      return;
    }

    const timingValue =
      preferredTiming === "custom"
        ? customTiming.trim()
        : preferredTiming.trim();

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const created = await createEventSuggestion({
        title: trimmedTitle,
        description: trimmedDescription,
        preferred_timing: timingValue || null,
      });
      setSuggestions((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setPreferredTiming("");
      setCustomTiming("");
      setShowForm(false);
      setSubmitSuccess("Thanks — your idea was submitted.");
    } catch (error) {
      setSubmitError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ideas-page">
      <header className="ideas-header">
        <div>
          <h1 className="ideas-title">Ideas</h1>
          <p className="ideas-subtitle">
            Member ideas for future NSA events — discuss, gauge interest, then
            plan.
          </p>
        </div>
        <button
          type="button"
          className="ideas-cta"
          onClick={() => {
            setShowForm((current) => !current);
            setSubmitError(null);
            setSubmitSuccess(null);
          }}
        >
          <AppIcon icon={Plus} size="sm" className="text-current" />
          {showForm ? "Close" : "New idea"}
        </button>
      </header>

      {suggestions.length > 0 || loading ? (
        <p className="ideas-summary" aria-label="Ideas summary">
          <span>
            {stats.total} {stats.total === 1 ? "idea" : "ideas"}
          </span>
          <span className="ideas-summary__dot" aria-hidden="true">
            ·
          </span>
          <span>{stats.pending} pending</span>
          <span className="ideas-summary__dot" aria-hidden="true">
            ·
          </span>
          <span>{stats.inDiscussion} in review</span>
        </p>
      ) : null}

      {submitSuccess ? (
        <p className="ideas-banner is-success" role="status">
          {submitSuccess}
        </p>
      ) : null}

      {showForm ? (
        <form
          className="ideas-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <h2 className="ideas-form__title">New idea</h2>
          <p className="ideas-form__copy">
            Share a title, what you have in mind, and optional timing.
          </p>

          {submitError ? (
            <p className="ideas-banner is-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="ideas-form__fields">
            <label className="block">
              <span className="ideas-form__label">Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                className={`${inputFieldClassName} mt-1`}
                placeholder="e.g. Spring cultural night"
              />
            </label>

            <label className="block">
              <span className="ideas-form__label">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={4}
                className={`${inputFieldClassName} mt-1`}
                placeholder="What would this look like?"
              />
            </label>

            <label className="block">
              <span className="ideas-form__label">
                Preferred timing{" "}
                <span className="text-label">(optional)</span>
              </span>
              <select
                value={preferredTiming}
                onChange={(event) => setPreferredTiming(event.target.value)}
                className={`${inputFieldClassName} mt-1`}
              >
                <option value="">No preference</option>
                {TIMING_SUGGESTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="custom">Other (type below)</option>
              </select>
            </label>

            {preferredTiming === "custom" ? (
              <label className="block">
                <span className="ideas-form__label">Your timing idea</span>
                <input
                  type="text"
                  value={customTiming}
                  onChange={(event) => setCustomTiming(event.target.value)}
                  className={`${inputFieldClassName} mt-1`}
                  placeholder="e.g. early March, after midterms"
                />
              </label>
            ) : null}
          </div>

          <div className="mt-4">
            <Button
              type="submit"
              disabled={submitting}
              loading={submitting}
              size="lg"
            >
              Submit idea
            </Button>
          </div>
        </form>
      ) : null}

      {suggestions.length > 0 ? (
        <>
          <div className="ideas-filters">
            <label className="ideas-search">
              <AppIcon icon={Search} size="sm" className="text-label" />
              <span className="sr-only">Search ideas</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ideas…"
              />
            </label>
            <label className="ideas-select">
              <span className="sr-only">Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
              >
                <option value="all">Status: All</option>
                <option value="submitted">Status: Submitted</option>
                <option value="internal_review">Status: Internal review</option>
                <option value="published">Status: Published</option>
                <option value="approved">Status: Approved</option>
                <option value="rejected">Status: Rejected</option>
                <option value="converted">Status: Converted</option>
                <option value="archived">Status: Archived</option>
              </select>
            </label>
            <label className="ideas-select">
              <span className="sr-only">Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="title">Sort: Title</option>
              </select>
            </label>
            {semesterOptions.length > 0 ? (
              <button
                type="button"
                className="ideas-more-filters"
                aria-expanded={moreFiltersOpen}
                onClick={() => setMoreFiltersOpen((open) => !open)}
              >
                <AppIcon
                  icon={SlidersHorizontal}
                  size="sm"
                  className="text-current"
                />
                Filter
                {moreFiltersActive ? (
                  <span className="ideas-more-filters__on">On</span>
                ) : null}
              </button>
            ) : null}
          </div>
          {moreFiltersOpen && semesterOptions.length > 0 ? (
            <div className="ideas-more-panel" aria-label="More filters">
              <label className="ideas-select">
                <span className="ideas-form__label">Semester</span>
                <select
                  value={semesterFilter}
                  onChange={(event) => setSemesterFilter(event.target.value)}
                >
                  <option value="all">Any</option>
                  {semesterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </>
      ) : null}

      {errorMessage ? (
        <div className="ds-alert-banner p-4 text-sm" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <p className="ideas-loading">Loading ideas…</p>
      ) : suggestions.length === 0 ? (
        <div className="ideas-empty">
          <h3>No ideas yet</h3>
          <p>
            Be the first to{" "}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="ideas-empty__link"
            >
              share one
            </button>
            .
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="ideas-empty is-soft">
          <h3>No ideas match these filters</h3>
          <p>Try clearing search or resetting status and semester.</p>
        </div>
      ) : (
        <div className="ideas-document">
          <ul className="ideas-list">
            {filtered.map((suggestion) => (
              <IdeaRow
                key={suggestion.id}
                suggestion={suggestion}
                canManage={canManage}
                onReviewed={(updated) =>
                  setSuggestions((current) =>
                    current.map((item) =>
                      item.id === updated.id ? updated : item,
                    ),
                  )
                }
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
