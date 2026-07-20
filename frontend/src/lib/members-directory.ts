/**
 * Members directory helpers — client-side filter + KPI derivation
 * from existing members / dues API payloads (no new endpoints).
 */

import type { MemberResponse } from "./auth-api";
import type { DuesStatus, MemberDuesRecord } from "./dues-api";
import { outstandingFromAmounts } from "./member-payments";

export type MembersDirectoryFilters = {
  search: string;
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
  /** Members with unpaid/partial dues; null when treasury data is unavailable. */
  outstandingDuesCount: number | null;
};

export type MemberEngagementLookup = Map<number, "active" | "idle">;

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

    if (filters.role && member.role !== filters.role) {
      return false;
    }

    if (
      filters.graduationYear &&
      String(member.graduation_year) !== filters.graduationYear
    ) {
      return false;
    }

    if (filters.memberStatus && member.status !== filters.memberStatus) {
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
  unpaidCount?: number | null;
  partialCount?: number | null;
  duesAvailable: boolean;
}): MembersDirectoryKpis {
  return {
    totalMembers: input.totalMembers,
    activeCount: input.activeCount,
    idleCount: input.idleCount ?? 0,
    pendingCount: input.pendingCount,
    outstandingDuesCount: input.duesAvailable
      ? (input.unpaidCount ?? 0) + (input.partialCount ?? 0)
      : null,
  };
}
