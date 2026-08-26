/**
 * Members directory helpers — client-side filter + KPI derivation
 * from existing members / dues API payloads (no new endpoints).
 */

import type { MemberResponse } from "./auth-api";
import type { DuesStatus, MemberDuesRecord } from "./dues-api";
import { outstandingFromAmounts } from "./member-payments";
import {
  formatPositionLabel,
  formatRoleLabel,
  isExclusiveMemberPosition,
  isMemberRole,
  isRoleAtLeast,
  type MemberPosition,
} from "./roles";

export type MembersDirectoryFilters = {
  search: string;
  /**
   * Directory scope chip / advanced role filter.
   * "" | "leadership" | "board" | "general" (Members) | exact MemberRole
   */
  role: string;
  committee: string;
  graduationYear: string;
  attendance: string;
  paymentStatus: string;
  memberStatus: string;
};

export const EMPTY_MEMBERS_DIRECTORY_FILTERS: MembersDirectoryFilters = {
  search: "",
  role: "",
  committee: "",
  graduationYear: "",
  attendance: "",
  paymentStatus: "",
  memberStatus: "",
};

export type MembersDirectoryKpis = {
  totalMembers: number;
  /** Activity-engaged approved members (attended, paid, tasks, suggestions). */
  activeCount: number;
  /** Approved members with no recent engagement signals. */
  idleCount: number;
  pendingCount: number;
  /** Board / officer seats in the loaded directory. */
  boardCount: number;
  /** Members with unpaid/partial dues; null when treasury data is unavailable. */
  outstandingDuesCount: number | null;
  /** Dollar total outstanding; null when treasury data is unavailable. */
  outstandingDuesAmount: number | null;
};

export type MemberEngagementLookup = Map<number, "active" | "idle">;

export type MembersDirectorySection = "leadership" | "board" | "general";

/** Hardcoded org hierarchy — not alphabetical. */
const POSITION_PRIORITY: Record<MemberPosition, number> = {
  president: 100,
  vice_president: 95,
  secretary: 90,
  treasurer: 85,
  event_manager: 80,
  public_relations_officer: 75,
  new_student_representative: 70,
  member: 10,
};

const CUSTOM_LEADERSHIP_PRIORITY = 65;
const BOARD_PRIORITY = 50;
const GENERAL_PRIORITY = 10;

/** Officer seats / custom chairs — authority, not just "board" role. */
export function isLeadershipMember(
  member: Pick<
    MemberResponse,
    "role" | "position" | "custom_board_position"
  >,
): boolean {
  if (isExclusiveMemberPosition(member.position)) {
    return true;
  }
  if (member.custom_board_position) {
    return true;
  }
  return member.role === "president" || member.role === "treasurer";
}

/** Non-leadership board+ roster (at-large board, etc.). */
export function isBoardRosterMember(
  member: Pick<
    MemberResponse,
    "role" | "position" | "custom_board_position"
  >,
): boolean {
  if (isLeadershipMember(member)) {
    return false;
  }
  return isMemberRole(member.role) && isRoleAtLeast(member.role, "board");
}

export function isGeneralRosterMember(
  member: Pick<
    MemberResponse,
    "role" | "position" | "custom_board_position"
  >,
): boolean {
  return !isLeadershipMember(member) && !isBoardRosterMember(member);
}

export function getMemberDirectoryPriority(
  member: Pick<
    MemberResponse,
    "role" | "position" | "custom_board_position"
  >,
): number {
  if (isExclusiveMemberPosition(member.position)) {
    return POSITION_PRIORITY[member.position];
  }
  if (member.custom_board_position) {
    return CUSTOM_LEADERSHIP_PRIORITY;
  }
  if (member.role === "president") {
    return POSITION_PRIORITY.president;
  }
  if (member.role === "treasurer") {
    return POSITION_PRIORITY.treasurer;
  }
  if (isMemberRole(member.role) && isRoleAtLeast(member.role, "board")) {
    return BOARD_PRIORITY;
  }
  return GENERAL_PRIORITY;
}

/**
 * Lower rank sorts first within the same priority.
 * Active → Pending → Idle/other → Alumni/archived
 */
export function getMemberDirectoryStatusRank(
  member: Pick<MemberResponse, "id" | "status">,
  engagementByMemberId?: MemberEngagementLookup,
): number {
  const status = member.status.trim().toLowerCase();
  if (status === "pending") {
    return 20;
  }
  if (status === "alumni" || status === "rejected" || status === "inactive") {
    return 80;
  }
  if (status === "approved") {
    const engagement = engagementByMemberId?.get(member.id);
    if (engagement === "active") {
      return 10;
    }
    if (engagement === "idle") {
      return 40;
    }
    return 30;
  }
  return 50;
}

export function compareMembersByDirectoryOrder(
  left: MemberResponse,
  right: MemberResponse,
  engagementByMemberId?: MemberEngagementLookup,
): number {
  const priority =
    getMemberDirectoryPriority(right) - getMemberDirectoryPriority(left);
  if (priority !== 0) {
    return priority;
  }
  const status =
    getMemberDirectoryStatusRank(left, engagementByMemberId) -
    getMemberDirectoryStatusRank(right, engagementByMemberId);
  if (status !== 0) {
    return status;
  }
  return left.full_name.localeCompare(right.full_name, undefined, {
    sensitivity: "base",
  });
}

export function sortMembersByDirectoryOrder(
  members: MemberResponse[],
  engagementByMemberId?: MemberEngagementLookup,
): MemberResponse[] {
  return [...members].sort((left, right) =>
    compareMembersByDirectoryOrder(left, right, engagementByMemberId),
  );
}

export function getMemberDirectorySection(
  member: Pick<
    MemberResponse,
    "role" | "position" | "custom_board_position"
  >,
): MembersDirectorySection {
  if (isLeadershipMember(member)) {
    return "leadership";
  }
  if (isBoardRosterMember(member)) {
    return "board";
  }
  return "general";
}

export function getDirectorySectionLabel(
  section: MembersDirectorySection,
): string {
  if (section === "leadership") {
    return "Leadership";
  }
  if (section === "board") {
    return "Board Members";
  }
  return "Members";
}

/** Display label for leadership seats (position preferred over role). */
export function getMemberDirectoryRoleLabel(
  member: Pick<
    MemberResponse,
    "role" | "position" | "custom_board_position"
  >,
): string {
  const customName = member.custom_board_position?.name?.trim();
  if (customName) {
    return customName;
  }
  if (isExclusiveMemberPosition(member.position)) {
    return formatPositionLabel(member.position);
  }
  if (!member.role) {
    return "—";
  }
  if (isMemberRole(member.role)) {
    return formatRoleLabel(member.role);
  }
  return formatRoleLabel("general");
}

/**
 * Secondary line under the name.
 * Leadership → seat title; Board/Members → major · year (never "Board"/"General").
 */
export function getMemberDirectorySubtitle(
  member: Pick<
    MemberResponse,
    | "role"
    | "position"
    | "custom_board_position"
    | "major"
    | "graduation_year"
  >,
  section: MembersDirectorySection = getMemberDirectorySection(member),
): string | null {
  if (section === "leadership") {
    const label = getMemberDirectoryRoleLabel(member);
    return label === "—" ? null : label;
  }

  const major = member.major?.trim() || "";
  const year = member.graduation_year;
  if (major && year) {
    return `${major} · ${year}`;
  }
  if (major) {
    return major;
  }
  if (year) {
    return `Class of ${year}`;
  }
  return null;
}

function matchesDirectoryRoleFilter(
  member: MemberResponse,
  roleFilter: string,
): boolean {
  if (!roleFilter) {
    return true;
  }
  if (roleFilter === "leadership") {
    return isLeadershipMember(member);
  }
  if (roleFilter === "board") {
    return isBoardRosterMember(member);
  }
  if (roleFilter === "general") {
    return isGeneralRosterMember(member);
  }
  return member.role === roleFilter;
}

export function buildEngagementLookup(
  entries: Array<{ member_id: number; status: "active" | "idle" }>,
): MemberEngagementLookup {
  const map: MemberEngagementLookup = new Map();
  for (const entry of entries) {
    map.set(entry.member_id, entry.status);
  }
  return map;
}

export type MemberDuesLookup = Map<number, MemberDuesRecord>;

export function buildDuesLookup(records: MemberDuesRecord[]): MemberDuesLookup {
  const map: MemberDuesLookup = new Map();
  for (const record of records) {
    map.set(record.member_id, record);
  }
  return map;
}

export function formatOutstandingDuesCell(
  record: MemberDuesRecord | undefined,
): string | null {
  if (!record) {
    return null;
  }
  const outstanding = outstandingFromAmounts(
    record.amount_owed,
    record.amount_paid,
  );
  if (outstanding <= 0) {
    return null;
  }
  return outstanding.toFixed(2);
}

function matchesPaymentFilter(
  record: MemberDuesRecord | undefined,
  paymentStatus: string,
): boolean {
  if (!paymentStatus) {
    return true;
  }
  if (!record) {
    return false;
  }
  const status = record.status as DuesStatus;
  if (paymentStatus === "outstanding") {
    return status === "unpaid" || status === "partial";
  }
  if (paymentStatus === "overdue") {
    // No due-date API on directory yet — treat unpaid/partial as overdue.
    return status === "unpaid" || status === "partial";
  }
  return status === paymentStatus;
}

/**
 * Filters members using fields available on MemberResponse + optional dues.
 * Committee / attendance are ignored until those fields exist on the API.
 */
export function filterDirectoryMembers(
  members: MemberResponse[],
  filters: MembersDirectoryFilters,
  duesByMemberId?: MemberDuesLookup,
): MemberResponse[] {
  const query = filters.search.trim().toLowerCase();

  return members.filter((member) => {
    if (query) {
      const haystack = [
        member.full_name,
        member.email ?? "",
        member.major,
        member.student_id ?? "",
        member.position,
        member.custom_board_position?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (!matchesDirectoryRoleFilter(member, filters.role)) {
      return false;
    }

    if (
      filters.graduationYear &&
      String(member.graduation_year) !== filters.graduationYear
    ) {
      return false;
    }

    if (filters.memberStatus) {
      if (member.status !== filters.memberStatus) {
        return false;
      }
    } else if (member.status === "rejected") {
      // Rejected signups live in Archive — keep them out of the active directory.
      return false;
    }

    if (filters.paymentStatus) {
      return matchesPaymentFilter(
        duesByMemberId?.get(member.id),
        filters.paymentStatus,
      );
    }

    return true;
  });
}

export function deriveMembersDirectoryKpis(input: {
  totalMembers: number;
  activeCount: number;
  idleCount?: number;
  pendingCount: number;
  boardCount?: number;
  unpaidCount?: number | null;
  partialCount?: number | null;
  outstandingAmount?: number | null;
  duesAvailable: boolean;
}): MembersDirectoryKpis {
  return {
    totalMembers: input.totalMembers,
    activeCount: input.activeCount,
    idleCount: input.idleCount ?? 0,
    pendingCount: input.pendingCount,
    boardCount: input.boardCount ?? 0,
    outstandingDuesCount: input.duesAvailable
      ? (input.unpaidCount ?? 0) + (input.partialCount ?? 0)
      : null,
    outstandingDuesAmount: input.duesAvailable
      ? (input.outstandingAmount ?? 0)
      : null,
  };
}
