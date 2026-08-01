import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { MeetingWorkspace } from "../components/MeetingWorkspace";
import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchMeetingDetail,
  type MeetingDetailResponse,
} from "../lib/meetings-api";

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
    return <p className="text-sm text-label">Loading meeting…</p>;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link to="/events/meetings" className="ds-link">
          ← Back to meetings
        </Link>
        <div role="alert" className="ds-alert-banner p-6">
          {error ?? "Meeting not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/events/meetings" className="ds-link">
        ← Back to meetings
      </Link>
      <MeetingWorkspace detail={detail} onDetailChange={setDetail} />
    </div>
  );
}
