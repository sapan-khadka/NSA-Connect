import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { MeetingRecordSection } from "../components/MeetingRecordSection";
import { MeetingStatusChips } from "../components/MeetingStatusChips";
import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchMeetingDetail,
  meetingRecordStatus,
  type MeetingDetailResponse,
} from "../lib/meetings-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { Card } from "../components/ui/Card";

export function MeetingDetailPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const numericEventId = Number(eventId);

  const [detail, setDetail] = useState<MeetingDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(numericEventId)) {
      setError("Invalid meeting.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchMeetingDetail(numericEventId);
        if (!cancelled) {
          setDetail(response);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [numericEventId]);

  useEffect(() => {
    if (!detail || location.hash !== "#meeting-minutes") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("meeting-minutes")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      document
        .getElementById("meeting-minutes-notes")
        ?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [detail, location.hash]);

  if (isLoading) {
    return <p className="text-sm text-label">Loading meeting…</p>;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link
          to="/events/meetings"
          className="ds-link"
        >
          ← Back to board meetings
        </Link>
        <div
          role="alert"
          className="ds-alert-banner p-6"
        >
          {error ?? "Meeting not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/events/meetings"
          className="ds-link"
        >
          ← Back to board meetings
        </Link>
      </div>

      <Card padding="md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-headline text-foreground">{detail.event_name}</h1>
            <p className="text-sm text-label">
              {formatEventDateTime(detail.starts_at)}
            </p>
            <MeetingStatusChips meeting={meetingRecordStatus(detail)} />
          </div>
          {detail.can_manage ? (
            <Link
              to={`/events/${detail.event_id}/manage`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5"
            >
              Manage event
            </Link>
          ) : null}
        </div>

        <Card as="div" padding="sm" className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-label">
            Agenda
          </h2>
          {detail.agenda ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {detail.agenda}
            </p>
          ) : (
            <p className="mt-2 text-sm text-label">
              No agenda was added when this meeting was created.
            </p>
          )}
        </Card>
      </Card>

      <MeetingRecordSection
        eventId={detail.event_id}
        eventName={detail.event_name}
      />
    </div>
  );
}
