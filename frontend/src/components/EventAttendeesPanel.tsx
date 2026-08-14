import { useMemo, useState } from "react";

import type { EventAttendeesResponse } from "../lib/events-api";
import { downloadAttendeesCsv } from "../lib/event-attendees-export";
import { formatCompactAttendeeSummary, formatRsvpStatus } from "../lib/event-rsvp";
import { ArrowAction } from "./ui/ArrowLink";
import { inputFieldClassName } from "./ui/Input";

type EventAttendeesPanelProps = {
  eventName: string;
  data: EventAttendeesResponse | null;
  loading: boolean;
  error: string | null;
};

function buildCompactSummary(data: EventAttendeesResponse): string {
  return formatCompactAttendeeSummary(data);
}

function buildFullSummary(data: EventAttendeesResponse): string {
  return `${data.going_count} going · ${data.maybe_count} maybe · ${data.not_going_count} not going · ${data.no_response_count} not yet responded`;
}

function AttendeeGroup({
  title,
  attendees,
}: {
  title: string;
  attendees: EventAttendeesResponse["attendees"];
}) {
  if (attendees.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="event-command-kicker">{title}</h3>
      <ul className="event-page-list">
        {attendees.map((attendee) => (
          <li key={attendee.member_id} className="event-page-list-row">
            <span className="event-page-list-title">{attendee.full_name}</span>
            <span className="event-command-stat">
              {formatRsvpStatus(attendee.rsvp_status)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EventAttendeesPanel({
  eventName,
  data,
  loading,
  error,
}: EventAttendeesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const filteredAttendees = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return data.attendees;
    }

    return data.attendees.filter((attendee) =>
      attendee.full_name.toLowerCase().includes(normalized),
    );
  }, [data, query]);

  const boardMembers = filteredAttendees.filter(
    (attendee) => attendee.member_type === "Board member",
  );
  const generalMembers = filteredAttendees.filter(
    (attendee) => attendee.member_type === "General member",
  );

  return (
    <div>
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Attendees</h2>
        {data ? (
          <ArrowAction onClick={() => setExpanded((current) => !current)}>
            {expanded ? "Hide" : "View"}
          </ArrowAction>
        ) : null}
      </div>

      {loading ? (
        <p className="event-command-stat">Loading attendees…</p>
      ) : null}
      {error ? (
        <p role="alert" className="ds-field-error">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <p className="event-command-stat" data-testid="attendee-rsvp-summary">
            {expanded ? buildFullSummary(data) : buildCompactSummary(data)}
          </p>

          {expanded ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Search attendees</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name…"
                    className={`${inputFieldClassName} event-workspace-search`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => downloadAttendeesCsv(data.attendees, eventName)}
                  className="event-command-btn"
                >
                  Export
                </button>
              </div>

              <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                {filteredAttendees.length === 0 ? (
                  <p className="event-command-stat">
                    {query.trim()
                      ? "No attendees match your search."
                      : "No approved members found."}
                  </p>
                ) : (
                  <>
                    <AttendeeGroup title="Board members" attendees={boardMembers} />
                    <AttendeeGroup
                      title="General members"
                      attendees={generalMembers}
                    />
                  </>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
