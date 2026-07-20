import { describe, expect, it } from "vitest";

import type { MemberResponse } from "./auth-api";
import type { MemberDuesRecord } from "./dues-api";
import {
  buildDuesLookup,
  deriveMembersDirectoryKpis,
  EMPTY_MEMBERS_DIRECTORY_FILTERS,
  filterDirectoryMembers,
  formatOutstandingDuesCell,
} from "./members-directory";

const member = (overrides: Partial<MemberResponse> = {}): MemberResponse => ({
  id: 1,
  full_name: "Alex Member",
  email: "alex@semo.edu",
  student_id: "S1",
  major: "CS",
  graduation_year: 2028,
  role: "board",
  status: "approved",
  position: "member",
  ...overrides,
});

const dues = (
  overrides: Partial<MemberDuesRecord> = {},
): MemberDuesRecord => ({
  id: 10,
  member_id: 1,
  member_name: "Alex Member",
  member_email: "alex@semo.edu",
  semester: "2026-fall",
  amount_owed: "20.00",
  amount_paid: "0.00",
  status: "unpaid",
  paid_at: null,
  payment_method: null,
  note: null,
  finance_entry_id: null,
  ...overrides,
});

describe("filterDirectoryMembers", () => {
  const members = [
    member({ id: 1, full_name: "Alex Member", role: "board" }),
    member({
      id: 2,
      full_name: "Sam General",
      role: "general",
      status: "pending",
      graduation_year: 2027,
    }),
  ];

  it("filters by search, role, year, and status", () => {
    expect(
      filterDirectoryMembers(members, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        search: "sam",
      }),
    ).toHaveLength(1);

    expect(
      filterDirectoryMembers(members, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        role: "board",
      }),
    ).toHaveLength(1);

    expect(
      filterDirectoryMembers(members, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        graduationYear: "2027",
      }),
    ).toHaveLength(1);

    expect(
      filterDirectoryMembers(members, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        memberStatus: "pending",
      }),
    ).toHaveLength(1);
  });

  it("filters by payment status when dues lookup is present", () => {
    const lookup = buildDuesLookup([dues({ member_id: 1, status: "unpaid" })]);
    expect(
      filterDirectoryMembers(
        members,
        {
          ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
          paymentStatus: "outstanding",
        },
        lookup,
      ),
    ).toEqual([members[0]]);
  });

  it("ignores unsupported committee/attendance filters for now", () => {
    expect(
      filterDirectoryMembers(members, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        committee: "events",
      }),
    ).toHaveLength(2);
  });
});

describe("formatOutstandingDuesCell", () => {
  it("formats remaining balance or null when paid", () => {
    expect(formatOutstandingDuesCell(dues())).toBe("20.00");
    expect(
      formatOutstandingDuesCell(
        dues({ amount_paid: "20.00", status: "paid" }),
      ),
    ).toBeNull();
  });
});

describe("deriveMembersDirectoryKpis", () => {
  it("sums unpaid + partial when dues are available", () => {
    expect(
      deriveMembersDirectoryKpis({
        totalMembers: 10,
        activeCount: 8,
        pendingCount: 2,
        unpaidCount: 3,
        partialCount: 1,
        duesAvailable: true,
      }),
    ).toEqual({
      totalMembers: 10,
      activeCount: 8,
      idleCount: 0,
      pendingCount: 2,
      outstandingDuesCount: 4,
    });
  });

  it("returns null outstanding when dues are unavailable", () => {
    expect(
      deriveMembersDirectoryKpis({
        totalMembers: 10,
        activeCount: 8,
        pendingCount: 2,
        duesAvailable: false,
      }).outstandingDuesCount,
    ).toBeNull();
  });
});
