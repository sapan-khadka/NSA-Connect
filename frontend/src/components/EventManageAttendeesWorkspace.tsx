import { useMemo, useState } from "react";

import type {
  EventAttendanceSummary,
  EventCheckInRecord,
} from "../lib/event-checkin-api";
import { downloadAttendeesCsv } from "../lib/event-attendees-export";
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";
import type {
  EventAttendeesResponse,
  EventParticipantInvitation,
  EventRsvpAttendee,
} from "../lib/events-api";
import { formatRsvpStatus } from "../lib/event-rsvp";
import { inputFieldClassName } from "./ui/Input";

type EventManageAttendeesWorkspaceProps = {
  eventName: string;
  eventCapacity: number | null;
  attendees: EventAttendeesResponse | null;
  attendeesLoading: boolean;
  invitations: EventParticipantInvitation[];
  checkIns: EventCheckInRecord[];
  attendanceSummary: EventAttendanceSummary | null;
  onInvite: () => void;
  onCheckIn: () => void;
  onViewAttendance: () => void;
};

type AttendeeRow = {
  id: string;
  name: string;
  status: string;
  checkedIn: boolean;
};

function buildRows(
  attendees: EventAttendeesResponse | null,
  invitations: EventParticipantInvitation[],
  checkedInIds: Set<number>,
): AttendeeRow[] {
  const rsvpRows: AttendeeRow[] = (attendees?.attendees ?? []).map(
    (person: EventRsvpAttendee) => ({
      id: `rsvp-${person.member_id}`,
      name: person.full_name,
      status: formatRsvpStatus(person.rsvp_status),
      checkedIn: checkedInIds.has(person.member_id),
    }),
  );
  const rsvpIds = new Set(
    (attendees?.attendees ?? []).map((person) => person.member_id),
  );
  const invitedRows: AttendeeRow[] = invitations
    .filter((invite) => !rsvpIds.has(invite.member_id))
    .map((invite) => ({
      id: `invite-${invite.member_id}`,
      name: invite.member_name,
      status: "Invited",
      checkedIn: checkedInIds.has(invite.member_id),
    }));
  return [...rsvpRows, ...invitedRows];
}

function summaryLine(
  attendees: EventAttendeesResponse | null,
  invited: number,
  checkInCount: number,
  capacity: number | null,
): string {
  const going = attendees?.going_count ?? 0;
  const maybe = attendees?.maybe_count ?? 0;
  const declined = attendees?.not_going_count ?? 0;
  const attending =
    capacity != null ? `${going} / ${capacity} going` : `${going} going`;
  const parts = [attending, `${invited} invited`, `${checkInCount} checked in`];
  if (maybe > 0) {
    parts.push(`${maybe} maybe`);
  }
  if (declined > 0) {
    parts.push(`${declined} declined`);
  }
  return parts.join(" · ");
}

export function EventManageAttendeesWorkspace({
  eventName,
  eventCapacity,
  attendees,
  attendeesLoading,
  invitations,
  checkIns,
  attendanceSummary,
  onInvite,
  onCheckIn,
  onViewAttendance,
}: EventManageAttendeesWorkspaceProps) {
  const [query, setQuery] = useState("");
  const checkedInIds = useMemo(() => {
    const ids = new Set<number>();
    for (const record of checkIns) {
      if (record.member_id != null) {
        ids.add(record.member_id);
      }
    }
    return ids;
  }, [checkIns]);

  const rows = useMemo(
    () => buildRows(attendees, invitations, checkedInIds),
    [attendees, invitations, checkedInIds],
  );
  const filtered = rows.filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="event-command">
      <section className="event-command-section is-flush" aria-label="Attendees">
        <div className="event-command-section-head">
          <h2 className="event-command-kicker">Attendees</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={EVENT_MANAGE_ACTION_LINK} onClick={onInvite}>
              Invite members
            </button>
            <button type="button" className={EVENT_MANAGE_ACTION_LINK} onClick={onCheckIn}>
              Check-in
            </button>
            {attendees && attendees.attendees.length > 0 ? (
              <button
                type="button"
                className={EVENT_MANAGE_ACTION_LINK}
                onClick={() => downloadAttendeesCsv(attendees.attendees, eventName)}
              >
                Export
              </button>
            ) : null}
            {attendanceSummary ? (
              <button
                type="button"
                className={EVENT_MANAGE_ACTION_LINK}
                onClick={onViewAttendance}
              >
                Attendance report
              </button>
            ) : null}
          </div>
        </div>
        <p className="event-command-stat">
          {attendeesLoading
            ? "—"
            : summaryLine(
                attendees,
                invitations.length,
                checkIns.length,
                eventCapacity,
              )}
        </p>
      </section>

      <div className="event-workspace-toolbar">
        <input
          type="search"
          value={query}
          onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          placeholder="Search attendees"
          aria-label="Search attendees"
          className={`${inputFieldClassName} event-workspace-search`}
        />
      </div>

      {attendeesLoading ? (
        <p className="event-command-stat">Loading attendees…</p>
      ) : filtered.length === 0 ? (
        <p className="event-command-stat">
          {rows.length === 0
            ? "No attendees yet. Invite members or wait for RSVPs."
            : "No attendees match this search."}
        </p>
      ) : (
        <table className="event-attendee-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Check-in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td className="text-[#737373]">{row.status}</td>
                <td className="text-[#737373]">
                  {row.checkedIn ? "Checked in" : "Not checked in"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
