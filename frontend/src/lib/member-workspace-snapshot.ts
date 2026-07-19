/**
 * Today's Snapshot — derive chip values from real member / dues / task data only.
 */

import type { MemberResponse } from "./auth-api";
import {
  formatMemberPositionLabel,
  formatRoleLabel,
  isMemberRole,
} from "./roles";

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

function boardRoleDisplayLabel(member: MemberResponse): string {
  const roleLabel = isMemberRole(member.role)
    ? formatRoleLabel(member.role)
    : MISSING;

  if (roleLabel === MISSING) {
    return MISSING;
  }

  if (
    member.custom_board_position ||
    (member.position && member.position !== "member")
  ) {
    return `${roleLabel} · ${formatMemberPositionLabel(member)}`;
  }

  return roleLabel;
}

export function buildMemberWorkspaceSnapshot(input: {
  member: MemberResponse;
  openTaskCount: number | null;
  /**
   * Same label source as Financial Status (`currentStatusLabel`).
   * Omit / null when dues history is unavailable to the viewer → "—".
   */
  duesStatusLabel?: string | null;
  /** Reserved for a future next-event RSVP API — omit → "—". */
  nextEventRsvpLabel?: string | null;
}): MemberWorkspaceSnapshotChip[] {
  const duesLabel = input.duesStatusLabel?.trim() || null;
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
