import type { EventRsvpAttendee } from "./events-api";
import { formatRsvpStatus } from "./event-rsvp";

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAttendeesCsv(attendees: EventRsvpAttendee[]): string {
  const header = "Name,Member type,RSVP status";
  const rows = attendees.map((attendee) =>
    [
      escapeCsvValue(attendee.full_name),
      escapeCsvValue(attendee.member_type),
      escapeCsvValue(formatRsvpStatus(attendee.rsvp_status)),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function downloadAttendeesCsv(
  attendees: EventRsvpAttendee[],
  eventName: string,
): void {
  const csv = buildAttendeesCsv(attendees);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = eventName.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
  link.href = url;
  link.download = `${safeName || "event"}-attendees.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
