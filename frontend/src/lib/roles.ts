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

/** Matches GET /v1/finance/event-budgets and the /finance route (board+). */
export function canAccessFinance(role: MemberRole): boolean {
  return isRoleAtLeast(role, "board");
}

/** Matches GET /v1/members and the /members route (board+). */
export function canViewMemberDirectory(role: MemberRole): boolean {
  return isRoleAtLeast(role, "board");
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

export const MEMBER_POSITIONS = [
  "president",
  "vice_president",
  "secretary",
  "treasurer",
  "event_manager",
  "public_relations_officer",
  "new_student_representative",
  "member",
] as const;

export type MemberPosition = (typeof MEMBER_POSITIONS)[number];

export const EXCLUSIVE_MEMBER_POSITIONS = MEMBER_POSITIONS.filter(
  (position) => position !== "member",
);

export function isExclusiveMemberPosition(
  position: MemberPosition,
): position is Exclude<MemberPosition, "member"> {
  return position !== "member";
}

export function buildPositionHolders(
  members: { id: number; full_name: string; position: MemberPosition }[],
): Partial<Record<MemberPosition, { id: number; full_name: string }>> {
  const holders: Partial<
    Record<MemberPosition, { id: number; full_name: string }>
  > = {};

  for (const member of members) {
    if (isExclusiveMemberPosition(member.position)) {
      holders[member.position] = {
        id: member.id,
        full_name: member.full_name,
      };
    }
  }

  return holders;
}

export function isMemberPosition(value: string): value is MemberPosition {
  return MEMBER_POSITIONS.includes(value as MemberPosition);
}

const POSITION_LABELS: Record<MemberPosition, string> = {
  president: "President",
  vice_president: "Vice President",
  secretary: "Secretary",
  treasurer: "Treasurer",
  event_manager: "Event Manager",
  public_relations_officer: "Public Relations Officer",
  new_student_representative: "New Student Representative",
  member: "Member",
};

export function formatPositionLabel(position: MemberPosition): string {
  return POSITION_LABELS[position] ?? position;
}

export const POSITION_BADGE_STYLES: Record<
  Exclude<MemberPosition, "member">,
  string
> = {
  president: "border-purple-200 bg-purple-50 text-purple-800",
  vice_president: "border-indigo-200 bg-indigo-50 text-indigo-800",
  secretary: "border-teal-200 bg-teal-50 text-teal-800",
  treasurer: "border-blue-200 bg-blue-50 text-blue-800",
  event_manager: "border-orange-200 bg-orange-50 text-orange-800",
  public_relations_officer: "border-pink-200 bg-pink-50 text-pink-800",
  new_student_representative: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function getPositionBadgeClassName(
  position: Exclude<MemberPosition, "member">,
  size: RoleBadgeSize = "sm",
): string {
  return [
    "inline-flex rounded-full border font-semibold tracking-wide",
    ROLE_BADGE_SIZE_STYLES[size],
    POSITION_BADGE_STYLES[position],
  ].join(" ");
}

/** Role badge/access label derived from assigned position (source of truth). */
export function getMemberDisplayRole(member: {
  role: MemberRole;
  position: MemberPosition;
}): MemberRole {
  if (member.position === "president") {
    return "president";
  }
  if (member.position === "treasurer") {
    return "treasurer";
  }
  if (member.role === "president" || member.role === "treasurer") {
    return "board";
  }
  return member.role;
}

/** Matches require_task_manager: President (role) or VP / Event Manager (position). */
export function canManageEventTasks(
  role: MemberRole,
  position: MemberPosition,
): boolean {
  return (
    role === "president" ||
    position === "vice_president" ||
    position === "event_manager"
  );
}

/** Matches require_task_oversight: President (role) or VP (position). */
export function canViewTaskOversight(
  role: MemberRole,
  position: MemberPosition,
): boolean {
  return role === "president" || position === "vice_president";
}

export const PROMOTABLE_BOARD_ROLES = ["general", "board"] as const;

export type PromotableBoardRole = (typeof PROMOTABLE_BOARD_ROLES)[number];

export function isPromotableBoardRole(role: string): role is PromotableBoardRole {
  return PROMOTABLE_BOARD_ROLES.includes(role as PromotableBoardRole);
}

export function canPresidentPromoteMember(
  member: {
    id: number;
    role: MemberRole;
    status: string;
    position: MemberPosition;
  },
  currentMemberId: number,
): boolean {
  return (
    member.id !== currentMemberId &&
    member.status === "approved" &&
    !isExclusiveMemberPosition(member.position) &&
    isPromotableBoardRole(member.role)
  );
}
