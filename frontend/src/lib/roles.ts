export const MEMBER_ROLES = [
  "general",
  "board",
  "treasurer",
  "president",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

const ROLE_LEVELS: Record<MemberRole, number> = {
  general: 1,
  board: 2,
  treasurer: 3,
  president: 4,
};

export function isMemberRole(value: string): value is MemberRole {
  return MEMBER_ROLES.includes(value as MemberRole);
}

export function isRoleAtLeast(role: MemberRole, required: MemberRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS[required];
}

export function getDashboardPath(role: MemberRole): string {
  return isRoleAtLeast(role, "board") ? "/board" : "/dashboard";
}

export function formatRoleLabel(role: MemberRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
