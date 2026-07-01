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
};

export function MeetingStatusChips({ meeting }: MeetingStatusChipsProps) {
  const chips: { label: string; className: string }[] = [];

  chips.push({
    label: meeting.is_past ? "Completed" : "Scheduled",
    className: meeting.is_past
      ? "bg-surface-muted text-foreground"
      : "bg-mint text-primary",
  });

  if (meeting.has_attendance) {
    chips.push({
      label: "Attendance recorded",
      className: "bg-mint text-primary",
    });
  } else if (meeting.is_past) {
    chips.push({
      label: "Attendance missing",
      className: "bg-surface-card text-label",
    });
  }

  if (meeting.has_summary) {
    chips.push({
      label: "Minutes published",
      className: "bg-mint text-primary",
    });
  } else if (meeting.has_minutes) {
    chips.push({
      label: "Draft saved",
      className: "bg-surface-muted text-foreground",
    });
  } else if (meeting.is_past) {
    chips.push({
      label: "Minutes missing",
      className: "bg-surface-card text-label",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={`rounded-full px-2.5 py-0.5 text-xs ${chip.className}`}
        >
          {chip.label}
        </span>
      ))}
      {meeting.has_attendance ? (
        <span className="text-xs text-label">
          {meeting.present_count} present · {meeting.absent_count} absent ·{" "}
          {meeting.excused_count} excused
          {meeting.unmarked_count > 0
            ? ` · ${meeting.unmarked_count} unmarked`
            : ""}
        </span>
      ) : null}
    </div>
  );
}
