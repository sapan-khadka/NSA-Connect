import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchEventFeedback,
  type EventFeedbackMember,
} from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { StarRatingDisplay } from "./StarRatingInput";

type EventFeedbackSectionProps = {
  eventId: number;
  eventName: string;
  refreshKey?: number;
};

function formatAverageRating(average: number, total: number): string {
  if (total === 0) {
    return "No feedback yet";
  }

  const label = total === 1 ? "response" : "responses";
  return `${average.toFixed(1)} average from ${total} ${label}`;
}

export function EventFeedbackSection({
  eventId,
  eventName,
  refreshKey = 0,
}: EventFeedbackSectionProps) {
  const [entries, setEntries] = useState<EventFeedbackMember[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    if (!Number.isFinite(eventId)) {
      setEntries([]);
      setError("Invalid event.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchEventFeedback(eventId);
      setEntries(response.feedback);
      setAverageRating(response.average_rating);
      setTotal(response.total);
    } catch (caught) {
      setEntries([]);
      setAverageRating(0);
      setTotal(0);
      setError(getApiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback, refreshKey]);

  return (
    <section className="ds-card p-6" data-testid="event-feedback-section">
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        Post-event feedback
      </h2>
      <p className="mt-1 text-sm text-label">
        Member ratings and comments for {eventName}. Only board members can view
        this summary.
      </p>

      <p className="mt-4 text-sm font-medium text-foreground">
        {formatAverageRating(averageRating, total)}
      </p>

      {error ? <p className="mt-4 ds-field-error">{error}</p> : null}
      {isLoading ? (
        <p className="mt-4 text-sm text-label">Loading feedback…</p>
      ) : null}

      {!isLoading && !error && entries.length === 0 ? (
        <p className="mt-4 text-sm text-label">No feedback submitted yet.</p>
      ) : null}

      {!isLoading && !error && entries.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-gray-200 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/members/${entry.member_id}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {entry.full_name}
                  </Link>
                  <p className="mt-1 text-xs text-label">
                    Submitted {formatEventDateTime(entry.created_at)}
                  </p>
                </div>
                <StarRatingDisplay rating={entry.rating} />
              </div>
              {entry.comment ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {entry.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
