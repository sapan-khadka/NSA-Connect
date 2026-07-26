import type { MeetingSummary } from "../lib/meetings-api";

type MeetingStatusChipsProps = {
  meeting: Pick<
    MeetingSummary,
    | "is_past"
    | "has_attendance"
    | "has_minutes"
    | "has_summary"
    | "present_count"
    | "absent_count"
    | "excused_count"
    | "unmarked_count"
  >;
  /** Dense list rows hide the attendance count line (shown separately). */
  compact?: boolean;
};

type Chip = {
  key: string;
  label: string;
  tone: "ok" | "warn" | "muted" | "scheduled";
};

export function MeetingStatusChips({
  meeting,
  compact = false,
}: MeetingStatusChipsProps) {
  const chips: Chip[] = [];

  // Skip redundant "Completed" — past meetings already live in semester groups.
  if (!meeting.is_past) {
    chips.push({ key: "status", label: "Scheduled", tone: "scheduled" });
  }

  if (meeting.has_attendance) {
    chips.push({ key: "attendance", label: "Attendance", tone: "ok" });
  } else if (meeting.is_past) {
    chips.push({
      key: "attendance",
      label: "Attendance missing",
      tone: "warn",
    });
  }

  if (meeting.has_summary) {
    chips.push({ key: "minutes", label: "Minutes", tone: "ok" });
  } else if (meeting.has_minutes) {
    chips.push({ key: "minutes", label: "Draft minutes", tone: "muted" });
  } else if (meeting.is_past) {
    chips.push({ key: "minutes", label: "Minutes missing", tone: "warn" });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "meeting-status-chips",
        compact ? "is-compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={`meeting-status-chip is-${chip.tone}`}
        >
          {chip.tone === "ok" ? (
            <span aria-hidden="true">✓</span>
          ) : null}
          {chip.tone === "warn" ? (
            <span aria-hidden="true">⚠</span>
          ) : null}
          {chip.label}
        </span>
      ))}
      {!compact && meeting.has_attendance ? (
        <span className="meeting-status-chips__meta">
          {meeting.present_count} Present · {meeting.absent_count} Absent
          {meeting.excused_count > 0
            ? ` · ${meeting.excused_count} Excused`
            : ""}
          {meeting.unmarked_count > 0
            ? ` · ${meeting.unmarked_count} unmarked`
            : ""}
        </span>
      ) : null}
    </div>
  );
}
