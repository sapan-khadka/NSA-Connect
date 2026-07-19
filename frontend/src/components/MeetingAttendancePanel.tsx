import { useEffect, useMemo, useState } from "react";

import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { PositionBadge } from "./PositionBadge";
import type { MeetingAttendanceEntry, MeetingAttendanceStatus } from "../lib/meetings-api";
import { formatPositionLabel, isExclusiveMemberPosition, type MemberPosition } from "../lib/roles";

const STATUS_OPTIONS: {
  value: MeetingAttendanceStatus;
  label: string;
  ariaLabel: string;
}[] = [
  { value: "present", label: "P", ariaLabel: "Present" },
  { value: "absent", label: "A", ariaLabel: "Absent" },
  { value: "excused", label: "E", ariaLabel: "Excused" },
];

function segmentClass(
  value: MeetingAttendanceStatus,
  selected: boolean,
): string {
  if (!selected) {
    return "text-label hover:text-foreground";
  }

  if (value === "present") {
    return "bg-accent text-white shadow-sm";
  }
  if (value === "absent") {
    return "bg-primary text-white shadow-sm";
  }
  return "bg-surface-card text-foreground shadow-sm ring-1 ring-gray-200";
}

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
    <Card padding="md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">
          Board attendance
        </h2>
        <dl className="flex flex-wrap gap-2 text-xs">
          <div className="rounded-full bg-mint/40 px-2.5 py-1 text-primary">
            <span className="font-medium">{presentCount}</span> P
          </div>
          <div className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
            <span className="font-medium">{absentCount}</span> A
          </div>
          <div className="rounded-full bg-surface-muted px-2.5 py-1 text-label">
            <span className="font-medium">{excusedCount}</span> E
          </div>
          {unmarkedCount > 0 ? (
            <div className="rounded-full bg-gray-100 px-2.5 py-1 text-foreground">
              <span className="font-medium">{unmarkedCount}</span> —
            </div>
          ) : null}
        </dl>
      </div>

      <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {attendance.map((entry) => (
          <li
            key={entry.member_id}
            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {entry.full_name}
              </p>
              {isExclusiveMemberPosition(entry.position as MemberPosition) ? (
                <PositionBadge
                  position={entry.position as Exclude<MemberPosition, "member">}
                />
              ) : entry.position && entry.position !== "member" ? (
                <PositionBadge
                  position="member"
                  customPositionName={entry.position}
                />
              ) : (
                <p className="text-xs text-label">
                  {formatPositionLabel("member")}
                </p>
              )}
            </div>

            {canManage ? (
              <div
                role="group"
                aria-label={`Attendance for ${entry.full_name}`}
                className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-0.5"
              >
                {STATUS_OPTIONS.map((option) => {
                  const selected = statuses[entry.member_id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.ariaLabel}
                      aria-pressed={selected}
                      onClick={() => setStatus(entry.member_id, option.value)}
                      className={[
                        "min-w-[2rem] rounded-full px-2 py-1 text-xs font-semibold transition-colors",
                        segmentClass(option.value, selected),
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
                  : "—"}
              </p>
            )}
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={!dirty || saving}
            loading={saving}
            onClick={() => void handleSave()}
          >
            Save attendance
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
