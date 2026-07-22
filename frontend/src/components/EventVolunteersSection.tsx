import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchEventVolunteerSignups,
  reviewEventVolunteerSignup,
  type EventVolunteerSignupMember,
  type EventVolunteerSignupStatus,
} from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { Card } from "./ui/Card";

type EventVolunteersSectionProps = {
  eventId: number;
  eventName: string;
  refreshKey?: number;
  canAssignTasks?: boolean;
  canReviewVolunteers?: boolean;
  onConvertToTask?: (signup: EventVolunteerSignupMember) => void;
};

function statusLabel(status: EventVolunteerSignupStatus): string {
  if (status === "approved") {
    return "Approved";
  }
  if (status === "rejected") {
    return "Declined";
  }
  return "Pending";
}

export function EventVolunteersSection({
  eventId,
  eventName,
  refreshKey = 0,
  canAssignTasks = false,
  canReviewVolunteers = false,
  onConvertToTask,
}: EventVolunteersSectionProps) {
  const [signups, setSignups] = useState<EventVolunteerSignupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const loadSignups = useCallback(async () => {
    if (!Number.isFinite(eventId)) {
      setSignups([]);
      setError("Invalid event.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchEventVolunteerSignups(eventId);
      setSignups(response.signups);
    } catch (caught) {
      setSignups([]);
      setError(getApiErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadSignups();
  }, [loadSignups, refreshKey]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadSignups();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadSignups]);

  async function handleReview(
    signupId: number,
    status: "approved" | "rejected",
  ) {
    setReviewingId(signupId);
    setError(null);
    try {
      const updated = await reviewEventVolunteerSignup(eventId, signupId, status);
      setSignups((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <Card padding="md" data-testid="event-volunteers-section">
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        Volunteers
      </h2>
      <p className="mt-1 text-sm text-label">
        Members who offered to help with {eventName}. Approve a request before
        assigning tasks. Open a name to view their profile.
      </p>

      {error ? <p className="mt-4 ds-field-error">{error}</p> : null}
      {isLoading ? (
        <p className="mt-4 text-sm text-label">Loading volunteers…</p>
      ) : null}

      {!isLoading && !error && signups.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-sm text-label">
          No volunteer signups yet.
        </p>
      ) : null}

      {!isLoading && signups.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {signups.map((signup) => (
            <li
              key={signup.id}
              className="rounded-lg border border-gray-100 bg-surface-muted/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/members/${signup.member_id}`}
                      className="text-sm font-medium text-foreground hover:text-accent"
                    >
                      {signup.full_name}
                    </Link>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        signup.status === "approved"
                          ? "bg-badge-teal-bg text-primary"
                          : signup.status === "rejected"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-800",
                      ].join(" ")}
                    >
                      {statusLabel(signup.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-label">
                    Signed up {formatEventDateTime(signup.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {canReviewVolunteers && signup.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        disabled={reviewingId === signup.id}
                        onClick={() => void handleReview(signup.id, "approved")}
                        className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === signup.id}
                        onClick={() => void handleReview(signup.id, "rejected")}
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </>
                  ) : null}
                  {canAssignTasks &&
                  onConvertToTask &&
                  signup.status === "approved" ? (
                    <button
                      type="button"
                      onClick={() => onConvertToTask(signup)}
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
                    >
                      Assign as task
                    </button>
                  ) : null}
                </div>
              </div>
              {signup.note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {signup.note}
                </p>
              ) : (
                <p className="mt-2 text-sm text-label">No note provided.</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
