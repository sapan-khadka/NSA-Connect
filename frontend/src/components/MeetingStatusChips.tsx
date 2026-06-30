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
      ? "border-gray-200 bg-gray-50 text-gray-700"
      : "border-blue-200 bg-blue-50 text-blue-800",
  });

  if (meeting.has_attendance) {
    chips.push({
      label: "Attendance recorded",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    });
  } else if (meeting.is_past) {
    chips.push({
      label: "Attendance missing",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    });
  }

  if (meeting.has_summary) {
    chips.push({
      label: "Minutes summarized",
      className: "border-teal-200 bg-teal-50 text-teal-800",
    });
  } else if (meeting.has_minutes) {
    chips.push({
      label: "Notes saved",
      className: "border-indigo-200 bg-indigo-50 text-indigo-800",
    });
  } else if (meeting.is_past) {
    chips.push({
      label: "Minutes missing",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${chip.className}`}
        >
          {chip.label}
        </span>
      ))}
      {meeting.has_attendance ? (
        <span className="text-xs text-gray-500">
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
