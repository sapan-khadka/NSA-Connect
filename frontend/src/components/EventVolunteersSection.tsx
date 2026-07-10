import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchEventVolunteerSignups,
  type EventVolunteerSignupMember,
} from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { Card } from "./ui/Card";

type EventVolunteersSectionProps = {
  eventId: number;
  eventName: string;
  refreshKey?: number;
  canAssignTasks?: boolean;
  onConvertToTask?: (signup: EventVolunteerSignupMember) => void;
};

export function EventVolunteersSection({
  eventId,
  eventName,
  refreshKey = 0,
  canAssignTasks = false,
  onConvertToTask,
}: EventVolunteersSectionProps) {
  const [signups, setSignups] = useState<EventVolunteerSignupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card padding="md" data-testid="event-volunteers-section">
      <h2 className="text-lg font-light tracking-subhead text-foreground">
        Volunteers
      </h2>
      <p className="mt-1 text-sm text-label">
        Members who offered to help with {eventName}. Open a name to view their
        profile and contact info (per directory privacy settings).
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
                  <Link
                    to={`/members/${signup.member_id}`}
                    className="text-sm font-medium text-foreground hover:text-accent"
                  >
                    {signup.full_name}
                  </Link>
                  <p className="mt-1 text-xs text-label">
                    Signed up {formatEventDateTime(signup.created_at)}
                  </p>
                </div>
                {canAssignTasks && onConvertToTask ? (
                  <button
                    type="button"
                    onClick={() => onConvertToTask(signup)}
                    className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    Assign as task
                  </button>
                ) : null}
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
