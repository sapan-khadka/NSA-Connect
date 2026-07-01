import { useEffect, useMemo, useState } from "react";

import { PositionBadge } from "./PositionBadge";
import type { MeetingAttendanceEntry, MeetingAttendanceStatus } from "../lib/meetings-api";
import { formatPositionLabel, isExclusiveMemberPosition, type MemberPosition } from "../lib/roles";

const STATUS_OPTIONS: {
  value: MeetingAttendanceStatus;
  label: string;
}[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
];

type MeetingAttendancePanelProps = {
  attendance: MeetingAttendanceEntry[];
  canManage: boolean;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  unmarkedCount: number;
  saving: boolean;
  onSave: (
    entries: { member_id: number; status: MeetingAttendanceStatus }[],
  ) => Promise<void>;
};

export function MeetingAttendancePanel({
  attendance,
  canManage,
  presentCount,
  absentCount,
  excusedCount,
  unmarkedCount,
  saving,
  onSave,
}: MeetingAttendancePanelProps) {
  const initialStatuses = useMemo(
    () =>
      Object.fromEntries(
        attendance.map((entry) => [entry.member_id, entry.status]),
      ) as Record<number, MeetingAttendanceStatus | null>,
    [attendance],
  );
  const [statuses, setStatuses] = useState(initialStatuses);

  useEffect(() => {
    setStatuses(initialStatuses);
  }, [initialStatuses]);

  const dirty = attendance.some(
    (entry) => (statuses[entry.member_id] ?? null) !== entry.status,
  );

  function setStatus(memberId: number, status: MeetingAttendanceStatus) {
    setStatuses((current) => ({ ...current, [memberId]: status }));
  }

  async function handleSave() {
    const entries = attendance
      .map((entry) => {
        const status = statuses[entry.member_id];
        return status ? { member_id: entry.member_id, status } : null;
      })
      .filter(
        (
          entry,
        ): entry is { member_id: number; status: MeetingAttendanceStatus } =>
          entry !== null,
      );

    await onSave(entries);
  }

  return (
    <section className="ds-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-light tracking-subhead text-foreground">Board attendance</h2>
          <p className="mt-1 text-sm text-label">
            Mark each board member as present, absent, or excused.
          </p>
        </div>
        <dl className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-full bg-mint px-3 py-1 text-primary">
            <span>{presentCount}</span> present
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            <span>{absentCount}</span> absent
          </div>
          <div className="rounded-full bg-surface-muted px-3 py-1 text-label">
            <span>{excusedCount}</span> excused
          </div>
          {unmarkedCount > 0 ? (
            <div className="rounded-full bg-gray-100 px-3 py-1 text-foreground">
              <span className="font-semibold">{unmarkedCount}</span> unmarked
            </div>
          ) : null}
        </dl>
      </div>

      <ul className="mt-5 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {attendance.map((entry) => (
          <li
            key={entry.member_id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{entry.full_name}</p>
              {isExclusiveMemberPosition(entry.position as MemberPosition) ? (
                <PositionBadge
                  position={entry.position as Exclude<MemberPosition, "member">}
                />
              ) : (
                <p className="text-xs text-label">
                  {formatPositionLabel(entry.position as MemberPosition)}
                </p>
              )}
            </div>

            {canManage ? (
              <div
                role="group"
                aria-label={`Attendance for ${entry.full_name}`}
                className="flex flex-wrap gap-2"
              >
                {STATUS_OPTIONS.map((option) => {
                  const selected = statuses[entry.member_id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStatus(entry.member_id, option.value)}
                      className={[
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        selected
                          ? option.value === "present"
                            ? "bg-accent text-white"
                            : option.value === "absent"
                              ? "bg-primary text-white"
                              : "bg-surface-card text-foreground ring-1 ring-gray-200"
                          : "bg-gray-100 text-foreground hover:bg-gray-200",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-label">
                {entry.status
                  ? STATUS_OPTIONS.find((option) => option.value === entry.status)
                      ?.label ?? entry.status
                  : "Not marked"}
              </p>
            )}
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving attendance…" : "Save attendance"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
