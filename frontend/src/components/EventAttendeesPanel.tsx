import { useMemo, useState } from "react";

import type { EventAttendeesResponse, RsvpStatus } from "../lib/events-api";
import { downloadAttendeesCsv } from "../lib/event-attendees-export";
import { formatCompactAttendeeSummary, formatRsvpStatus } from "../lib/event-rsvp";

type EventAttendeesPanelProps = {
  eventName: string;
  data: EventAttendeesResponse | null;
  loading: boolean;
  error: string | null;
};

function statusBadgeClass(status: RsvpStatus | null): string {
  if (status === "going") {
    return "bg-accent/10 text-foreground";
  }
  if (status === "maybe") {
    return "bg-surface-muted text-label";
  }
  if (status === "not_going") {
    return "bg-gray-100 text-foreground";
  }
  return "border border-urgent/30 bg-urgent/5 text-foreground";
}

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
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 space-y-2">
        {attendees.map((attendee) => (
          <li
            key={attendee.member_id}
            className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-surface-muted/40 px-3 py-2"
          >
            <span className="text-sm font-medium text-foreground">
              {attendee.full_name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(attendee.rsvp_status)}`}
            >
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
    <div className="space-y-3">
      <h2 className="text-lg font-light tracking-subhead text-foreground">Attendees</h2>

      {loading ? (
        <p className="text-sm text-label">Loading attendees…</p>
      ) : null}
      {error ? (
        <p role="alert" className="ds-field-error">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className="text-sm text-label"
              data-testid="attendee-rsvp-summary"
            >
              {expanded ? buildFullSummary(data) : buildCompactSummary(data)}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              {expanded ? "Hide ⌃" : "Show ⌄"}
            </button>
          </div>

          {expanded ? (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => downloadAttendeesCsv(data.attendees, eventName)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  Export attendee list
                </button>
              </div>

              <label className="block">
                <span className="sr-only">Search attendees</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </label>

              <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                {filteredAttendees.length === 0 ? (
                  <p className="text-sm text-label">
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
