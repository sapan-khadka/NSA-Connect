/**
 * Today's Snapshot — derive chip values from real member / dues / task data only.
 */

import type { MemberResponse } from "./auth-api";
import type { DuesStatus, MemberDuesRecord } from "./dues-api";
import { formatPositionLabel, formatRoleLabel, isMemberRole } from "./roles";

export type MemberWorkspaceSnapshotChipId =
  | "active_status"
  | "dues_status"
  | "next_event_rsvp"
  | "open_tasks"
  | "board_role"
  | "graduation_year";

export type MemberWorkspaceSnapshotChip = {
  id: MemberWorkspaceSnapshotChipId;
  label: string;
  value: string;
  muted: boolean;
};

const MISSING = "—";

function statusDisplayLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  const map: Record<string, string> = {
    approved: "Active",
    pending: "Pending",
    rejected: "Inactive",
    inactive: "Inactive",
    alumni: "Alumni",
  };
  return (
    map[normalized] ??
    (status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : MISSING)
  );
}

function duesStatusDisplayLabel(
  record: MemberDuesRecord | undefined,
): string | null {
  if (!record) {
    return null;
  }
  const labels: Record<DuesStatus, string> = {
    paid: "Paid",
    unpaid: "Unpaid",
    partial: "Partial",
    exempt: "Exempt",
  };
  return labels[record.status] ?? null;
}

function boardRoleDisplayLabel(member: MemberResponse): string {
  const roleLabel = isMemberRole(member.role)
    ? formatRoleLabel(member.role)
    : member.role
      ? member.role.charAt(0).toUpperCase() + member.role.slice(1)
      : MISSING;

  if (!roleLabel || roleLabel === MISSING) {
    return MISSING;
  }

  if (member.position && member.position !== "member") {
    return `${roleLabel} · ${formatPositionLabel(member.position)}`;
  }

  return roleLabel;
}

export function buildMemberWorkspaceSnapshot(input: {
  member: MemberResponse;
  openTaskCount: number | null;
  duesRecord?: MemberDuesRecord | undefined;
  /** Reserved for a future next-event RSVP API — omit → "—". */
  nextEventRsvpLabel?: string | null;
}): MemberWorkspaceSnapshotChip[] {
  const duesLabel = duesStatusDisplayLabel(input.duesRecord);
  const rsvpLabel = input.nextEventRsvpLabel?.trim() || null;
  const roleLabel = boardRoleDisplayLabel(input.member);
  const graduation =
    input.member.graduation_year != null
      ? String(input.member.graduation_year)
      : MISSING;

  return [
    {
      id: "active_status",
      label: "Active Status",
      value: statusDisplayLabel(input.member.status),
      muted: !input.member.status,
    },
    {
      id: "dues_status",
      label: "Dues Status",
      value: duesLabel ?? MISSING,
      muted: duesLabel === null,
    },
    {
      id: "next_event_rsvp",
      label: "Next Event RSVP",
      value: rsvpLabel ?? MISSING,
      muted: rsvpLabel === null,
    },
    {
      id: "open_tasks",
      label: "Open Tasks",
      value:
        input.openTaskCount === null ? MISSING : String(input.openTaskCount),
      muted: input.openTaskCount === null,
    },
    {
      id: "board_role",
      label: "Board / Committee Role",
      value: roleLabel,
      muted: roleLabel === MISSING,
    },
    {
      id: "graduation_year",
      label: "Graduation Year",
      value: graduation,
      muted: graduation === MISSING,
    },
  ];
}
