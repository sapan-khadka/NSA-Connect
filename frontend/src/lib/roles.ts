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
  return isRoleAtLeast(role, "board") ? "/board" : "/member";
}

export function formatRoleLabel(role: MemberRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export const ROLE_BADGE_STYLES: Record<MemberRole, string> = {
  president: "border-purple-200 bg-purple-50 text-purple-800",
  treasurer: "border-blue-200 bg-blue-50 text-blue-800",
  board: "border-accent/30 bg-accent/10 text-accent",
  general: "border-gray-200 bg-gray-50 text-gray-700",
};

const ROLE_BADGE_SIZE_STYLES = {
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
} as const;

export type RoleBadgeSize = keyof typeof ROLE_BADGE_SIZE_STYLES;

export function getRoleBadgeClassName(
  role: MemberRole,
  size: RoleBadgeSize = "sm",
): string {
  return [
    "inline-flex rounded-full border font-semibold uppercase tracking-wide",
    ROLE_BADGE_SIZE_STYLES[size],
    ROLE_BADGE_STYLES[role],
  ].join(" ");
}
