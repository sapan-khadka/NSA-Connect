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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Board attendance</h2>
          <p className="mt-1 text-sm text-gray-500">
            Mark each board member as present, absent, or excused.
          </p>
        </div>
        <dl className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
            <span className="font-semibold">{presentCount}</span> present
          </div>
          <div className="rounded-full bg-red-50 px-3 py-1 text-red-800">
            <span className="font-semibold">{absentCount}</span> absent
          </div>
          <div className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">
            <span className="font-semibold">{excusedCount}</span> excused
          </div>
          {unmarkedCount > 0 ? (
            <div className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
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
              <p className="font-medium text-primary">{entry.full_name}</p>
              {isExclusiveMemberPosition(entry.position as MemberPosition) ? (
                <PositionBadge
                  position={entry.position as Exclude<MemberPosition, "member">}
                />
              ) : (
                <p className="text-xs text-gray-500">
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
                            ? "bg-emerald-600 text-white"
                            : option.value === "absent"
                              ? "bg-red-600 text-white"
                              : "bg-amber-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
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
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving attendance…" : "Save attendance"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
