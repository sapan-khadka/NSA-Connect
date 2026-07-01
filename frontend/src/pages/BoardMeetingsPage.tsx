import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { MeetingStatusChips } from "../components/MeetingStatusChips";
import { PageHeader } from "../components/PageHeader";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMeetings, type MeetingSummary } from "../lib/meetings-api";
import { formatEventDateTime } from "../lib/format-datetime";

function groupMeetings(meetings: MeetingSummary[]) {
  const upcoming = meetings.filter((meeting) => !meeting.is_past);
  const past = meetings.filter((meeting) => meeting.is_past);
  return { upcoming, past };
}

function MeetingListSection({
  title,
  meetings,
}: {
  title: string;
  meetings: MeetingSummary[];
}) {
  if (meetings.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-label">
        {title}
      </h2>
      <div className="grid gap-4">
        {meetings.map((meeting) => (
          <article
            key={meeting.event_id}
            className="ds-card p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {meeting.event_name}
                  </h3>
                  <p className="mt-1 text-sm text-label">
                    {formatEventDateTime(meeting.starts_at)}
                  </p>
                </div>
                {meeting.agenda ? (
                  <p className="line-clamp-2 text-sm text-label">
                    <span className="font-medium text-foreground">Agenda:</span>{" "}
                    {meeting.agenda}
                  </p>
                ) : null}
                <MeetingStatusChips meeting={meeting} />
              </div>
              <Link
                to={`/events/meetings/${meeting.event_id}`}
                className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/5"
              >
                View meeting
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BoardMeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchMeetings();
        if (!cancelled) {
          setMeetings(response.meetings);
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
  }, []);

  const { upcoming, past } = useMemo(() => groupMeetings(meetings), [meetings]);
  const recordedCount = meetings.filter(
    (meeting) => meeting.has_attendance || meeting.has_minutes,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board meetings"
        description="Official record of NSA board meetings — agenda, attendance, and minutes from calendar events."
      />

      {!isLoading && meetings.length > 0 ? (
        <p className="text-sm text-label">
          {recordedCount} of {meetings.length} meeting
          {meetings.length === 1 ? "" : "s"} have attendance or minutes on file.
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-label">Loading board meetings…</p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="ds-alert-banner p-6"
        >
          {error}
        </div>
      ) : null}

      {!isLoading && !error && meetings.length === 0 ? (
        <section className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-lg font-light tracking-subhead text-foreground">No board meetings yet</p>
          <p className="mt-2 text-label">
            Create a meeting event on the calendar, then record attendance and
            minutes from the meeting page.
          </p>
          <Link
            to="/events/calendar"
            className="mt-4 inline-block ds-link"
          >
            Open calendar
          </Link>
        </section>
      ) : null}

      {!isLoading && !error && meetings.length > 0 ? (
        <div className="space-y-8">
          <MeetingListSection title="Upcoming" meetings={upcoming} />
          <MeetingListSection title="Past" meetings={past} />
        </div>
      ) : null}
    </div>
  );
}
