export const MEMBER_ROLES = [
  "general",
  "board",
  "treasurer",
  "president",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Cross-tenant platform roles (orthogonal to org MemberRole). */
export const PLATFORM_ROLES = [
  "super_admin",
  "university_admin",
  "university_staff",
  "student",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

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

export function getDashboardPath(_role: MemberRole): string {
  return "/";
}

/** Treasurer, president, or vice president — treasury write access and Home log actions. */
export function canManageTreasury(
  role: MemberRole,
  position?: MemberPosition,
): boolean {
  if (isRoleAtLeast(role, "treasurer")) {
    return true;
  }
  return position === "vice_president";
}

/** Matches GET /v1/finance/event-budgets and the /finance route (board+). */
export function canAccessFinance(role: MemberRole): boolean {
  return isRoleAtLeast(role, "board");
}

/** Matches board-only member admin (pending approvals, role/position controls). */
export function canViewMemberDirectory(role: MemberRole): boolean {
  return isRoleAtLeast(role, "board");
}

/**
 * Member documents: self may manage own files; board+ may manage any member's.
 *
 * Advisor access is intentionally deferred — there is no Advisor role in the
 * current model (general | board | treasurer | president). Define Advisor
 * document permissions only if/when that role is introduced; do not guess.
 */
export function canAccessMemberDocuments(
  role: MemberRole,
  viewerId: number,
  subjectMemberId: number,
): boolean {
  if (viewerId === subjectMemberId) {
    return true;
  }
  return isRoleAtLeast(role, "board");
}

/** All approved members can browse the networking directory. */
export function canBrowseMemberDirectory(_role: MemberRole): boolean {
  return true;
}

export function formatRoleLabel(role: MemberRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export const ROLE_BADGE_STYLES: Record<MemberRole, string> = {
  president: "bg-roleBadge-president-bg text-roleBadge-president",
  treasurer: "bg-roleBadge-treasurer-bg text-roleBadge-treasurer",
  board: "bg-roleBadge-board-bg text-roleBadge-board",
  general: "bg-roleBadge-general-bg text-roleBadge-general",
};

const ROLE_BADGE_SIZE_STYLES = {
  sm: "py-1 px-2.5 text-xs",
  md: "py-1.5 px-3 text-sm",
} as const;

export type RoleBadgeSize = keyof typeof ROLE_BADGE_SIZE_STYLES;

const BADGE_BASE_CLASS =
  "inline-flex items-center gap-1.5 rounded-pill font-medium";

export function getRoleBadgeClassName(
  role: MemberRole,
  size: RoleBadgeSize = "sm",
): string {
  return [
    BADGE_BASE_CLASS,
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

/** Display label for built-in or custom board seat. */
export function formatMemberPositionLabel(member: {
  position: MemberPosition;
  custom_board_position?: { name: string } | null;
}): string {
  if (member.custom_board_position?.name) {
    return member.custom_board_position.name;
  }
  return formatPositionLabel(member.position);
}

export function memberHoldsBoardSeat(member: {
  position: MemberPosition;
  custom_board_position?: { id: number } | null;
}): boolean {
  return (
    isExclusiveMemberPosition(member.position) ||
    Boolean(member.custom_board_position)
  );
}

export const POSITION_BADGE_STYLES: Record<
  Exclude<MemberPosition, "member">,
  string
> = {
  president: "bg-roleBadge-president-bg text-roleBadge-president",
  vice_president: "bg-roleBadge-vicePresident-bg text-roleBadge-vicePresident",
  secretary: "bg-roleBadge-secretary-bg text-roleBadge-secretary",
  treasurer: "bg-roleBadge-treasurer-bg text-roleBadge-treasurer",
  event_manager: "bg-roleBadge-eventManager-bg text-roleBadge-eventManager",
  public_relations_officer: "bg-roleBadge-pro-bg text-roleBadge-pro",
  new_student_representative: "bg-roleBadge-nsr-bg text-roleBadge-nsr",
};

export const CUSTOM_POSITION_BADGE_STYLE =
  "bg-roleBadge-board-bg text-roleBadge-board";

export function getPositionBadgeClassName(
  position: Exclude<MemberPosition, "member">,
  size: RoleBadgeSize = "sm",
): string {
  return [
    BADGE_BASE_CLASS,
    ROLE_BADGE_SIZE_STYLES[size],
    POSITION_BADGE_STYLES[position],
  ].join(" ");
}

export function getCustomPositionBadgeClassName(
  size: RoleBadgeSize = "sm",
): string {
  return [
    BADGE_BASE_CLASS,
    ROLE_BADGE_SIZE_STYLES[size],
    CUSTOM_POSITION_BADGE_STYLE,
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

/** Secretary, VP, or President can record meeting attendance and minutes. */
export function canManageMeetingRecords(
  role: MemberRole,
  position: MemberPosition,
): boolean {
  return (
    role === "president" ||
    position === "secretary" ||
    position === "vice_president"
  );
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
    custom_board_position?: { id: number } | null;
  },
  currentMemberId: number,
): boolean {
  return (
    member.id !== currentMemberId &&
    member.status === "approved" &&
    !memberHoldsBoardSeat(member) &&
    isPromotableBoardRole(member.role)
  );
}
