import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { MeetingRecordSection } from "../components/MeetingRecordSection";
import { MeetingStatusChips } from "../components/MeetingStatusChips";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchMeetingDetail,
  meetingRecordStatus,
  type MeetingDetailResponse,
} from "../lib/meetings-api";
import { formatEventDateTime } from "../lib/format-datetime";

export function MeetingDetailPage() {
  const { eventId } = useParams();
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

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading meeting…</p>;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link
          to="/events/meetings"
          className="text-sm text-accent hover:underline"
        >
          ← Back to board meetings
        </Link>
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800"
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
          className="text-sm text-accent hover:underline"
        >
          ← Back to board meetings
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary">{detail.event_name}</h1>
            <p className="text-sm text-gray-600">
              {formatEventDateTime(detail.starts_at)}
            </p>
            <MeetingStatusChips meeting={meetingRecordStatus(detail)} />
          </div>
          {detail.can_manage ? (
            <Link
              to={`/events/${detail.event_id}/manage`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-primary transition hover:border-accent hover:bg-accent/5"
            >
              Manage event
            </Link>
          ) : null}
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Agenda
          </h2>
          {detail.agenda ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {detail.agenda}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              No agenda was added when this meeting was created.
            </p>
          )}
        </div>
      </section>

      <MeetingRecordSection
        eventId={detail.event_id}
        eventName={detail.event_name}
      />
    </div>
  );
}
