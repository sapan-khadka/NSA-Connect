/**
 * Platform permission catalog (mirrors backend/app/core/permissions.py).
 *
 * Code-only for now — organizations cannot invent new permission types.
 * UI role editors are explicitly out of scope for the tenancy foundation pass.
 */

import type { MemberPosition, MemberRole } from "./roles";

export const PERMISSIONS = [
  "manage_members",
  "invite_members",
  "assign_roles",
  "manage_events",
  "manage_finance",
  "manage_finance_write",
  "manage_tasks",
  "view_task_oversight",
  "manage_meetings",
  "manage_discussions",
  "manage_announcements",
  "manage_documents",
  "manage_gallery",
  "manage_ai",
  "manage_reports",
  "manage_org_settings",
  "transfer_ownership",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const BOARD_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "manage_members",
  "invite_members",
  "manage_events",
  "manage_finance",
  "manage_discussions",
  "manage_announcements",
  "manage_documents",
  "manage_gallery",
  "manage_ai",
  "manage_reports",
]);

const TREASURER_EXTRA: ReadonlySet<Permission> = new Set(["manage_finance_write"]);

const PRESIDENT_EXTRA: ReadonlySet<Permission> = new Set([
  "assign_roles",
  "manage_tasks",
  "view_task_oversight",
  "manage_meetings",
  "manage_org_settings",
]);

/** Org owner: approvals/settings monitor — not task ops unless also an officer. */
const OWNER_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "manage_members",
  "invite_members",
  "assign_roles",
  "manage_org_settings",
  "transfer_ownership",
  "manage_events",
  "manage_finance",
  "manage_discussions",
  "manage_announcements",
  "manage_documents",
  "manage_gallery",
  "manage_ai",
  "manage_reports",
]);

const ROLE_LEVELS: Record<MemberRole, number> = {
  general: 1,
  board: 2,
  treasurer: 3,
  president: 4,
};

function roleAtLeast(role: MemberRole, minimum: MemberRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimum];
}

function permissionsForRole(role: MemberRole): Set<Permission> {
  const perms = new Set<Permission>();
  if (roleAtLeast(role, "board")) {
    for (const permission of BOARD_PERMISSIONS) {
      perms.add(permission);
    }
  }
  if (roleAtLeast(role, "treasurer")) {
    for (const permission of TREASURER_EXTRA) {
      perms.add(permission);
    }
  }
  if (role === "president") {
    for (const permission of PRESIDENT_EXTRA) {
      perms.add(permission);
    }
  }
  return perms;
}

function permissionsForPosition(position: MemberPosition): Set<Permission> {
  const perms = new Set<Permission>();
  if (position === "vice_president") {
    perms.add("manage_finance_write");
    perms.add("manage_tasks");
    perms.add("view_task_oversight");
    perms.add("manage_meetings");
  }
  if (position === "event_manager") {
    perms.add("manage_tasks");
  }
  if (position === "secretary") {
    perms.add("manage_meetings");
  }
  if (position === "president") {
    for (const permission of [
      ...BOARD_PERMISSIONS,
      ...TREASURER_EXTRA,
      ...PRESIDENT_EXTRA,
    ]) {
      perms.add(permission);
    }
  }
  if (position === "treasurer") {
    for (const permission of [...BOARD_PERMISSIONS, ...TREASURER_EXTRA]) {
      perms.add(permission);
    }
  }
  return perms;
}

export function permissionsForMembership(opts: {
  role: MemberRole;
  position: MemberPosition;
  isOrgOwner?: boolean;
}): Set<Permission> {
  const perms = new Set<Permission>([
    ...permissionsForRole(opts.role),
    ...permissionsForPosition(opts.position),
  ]);
  if (opts.isOrgOwner) {
    for (const permission of OWNER_PERMISSIONS) {
      perms.add(permission);
    }
  }
  return perms;
}

export function membershipHas(
  opts: {
    role: MemberRole;
    position: MemberPosition;
    isOrgOwner?: boolean;
  },
  permission: Permission,
): boolean {
  return permissionsForMembership(opts).has(permission);
}
