import { describe, expect, it } from "vitest";

import type { MemberResponse } from "./auth-api";
import type { MemberDuesRecord } from "./dues-api";
import {
  buildDuesLookup,
  buildEngagementLookup,
  deriveMembersDirectoryKpis,
  EMPTY_MEMBERS_DIRECTORY_FILTERS,
  filterDirectoryMembers,
  formatOutstandingDuesCell,
  getDirectorySectionLabel,
  getMemberDirectoryPriority,
  getMemberDirectoryRoleLabel,
  getMemberDirectorySection,
  getMemberDirectorySubtitle,
  isBoardRosterMember,
  isGeneralRosterMember,
  isLeadershipMember,
  sortMembersByDirectoryOrder,
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

describe("directory roster classification", () => {
  it("treats officer seats as leadership, not at-large board", () => {
    const president = member({
      id: 1,
      role: "president",
      position: "president",
    });
    const atLarge = member({ id: 2, role: "board", position: "member" });
    const general = member({ id: 3, role: "general", position: "member" });

    expect(isLeadershipMember(president)).toBe(true);
    expect(isBoardRosterMember(president)).toBe(false);
    expect(getMemberDirectorySection(president)).toBe("leadership");
    expect(getMemberDirectoryPriority(president)).toBe(100);

    expect(isLeadershipMember(atLarge)).toBe(false);
    expect(isBoardRosterMember(atLarge)).toBe(true);
    expect(getMemberDirectorySection(atLarge)).toBe("board");
    expect(getMemberDirectoryPriority(atLarge)).toBe(50);

    expect(isGeneralRosterMember(general)).toBe(true);
    expect(getMemberDirectorySection(general)).toBe("general");
    expect(getMemberDirectoryPriority(general)).toBe(10);
  });
});

describe("getDirectorySectionLabel", () => {
  it("uses short section titles", () => {
    expect(getDirectorySectionLabel("leadership")).toBe("Leadership");
    expect(getDirectorySectionLabel("board")).toBe("Board Members");
    expect(getDirectorySectionLabel("general")).toBe("Members");
  });
});

describe("getMemberDirectoryRoleLabel", () => {
  it("prefers position labels over generic role", () => {
    expect(
      getMemberDirectoryRoleLabel(
        member({ role: "president", position: "president" }),
      ),
    ).toBe("President");
    expect(
      getMemberDirectoryRoleLabel(
        member({ role: "board", position: "event_manager" }),
      ),
    ).toBe("Event Manager");
    expect(
      getMemberDirectoryRoleLabel(
        member({ role: "board", position: "member" }),
      ),
    ).toBe("Board");
    expect(
      getMemberDirectoryRoleLabel(
        member({ role: "general", position: "member" }),
      ),
    ).toBe("General");
  });
});

describe("getMemberDirectorySubtitle", () => {
  it("shows seat for leadership and major · year for everyone else", () => {
    expect(
      getMemberDirectorySubtitle(
        member({
          role: "president",
          position: "president",
          major: "CS",
          graduation_year: 2028,
        }),
      ),
    ).toBe("President");

    expect(
      getMemberDirectorySubtitle(
        member({
          role: "board",
          position: "member",
          major: "Computer Science",
          graduation_year: 2028,
        }),
      ),
    ).toBe("Computer Science · 2028");

    expect(
      getMemberDirectorySubtitle(
        member({
          role: "general",
          position: "member",
          major: "",
          graduation_year: 2027,
        }),
      ),
    ).toBe("Class of 2027");
  });
});

describe("filterDirectoryMembers", () => {
  const members = [
    member({
      id: 1,
      full_name: "Alex Board",
      role: "board",
      position: "member",
    }),
    member({
      id: 2,
      full_name: "Sam General",
      role: "general",
      status: "pending",
      graduation_year: 2027,
    }),
    member({
      id: 3,
      full_name: "Pat President",
      role: "president",
      position: "president",
    }),
  ];

  it("filters by search, roster group, year, and status", () => {
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
    ).toEqual([members[0]]);

    expect(
      filterDirectoryMembers(members, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        role: "leadership",
      }),
    ).toEqual([members[2]]);

    expect(
      filterDirectoryMembers(members, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        role: "general",
      }),
    ).toEqual([members[1]]);

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

  it("hides rejected members from the active directory unless Archive is open", () => {
    const withRejected = [
      ...members,
      member({
        id: 4,
        full_name: "Rejected Person",
        role: "general",
        status: "rejected",
      }),
    ];

    expect(
      filterDirectoryMembers(withRejected, EMPTY_MEMBERS_DIRECTORY_FILTERS).map(
        (row) => row.id,
      ),
    ).toEqual([1, 2, 3]);

    expect(
      filterDirectoryMembers(withRejected, {
        ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
        memberStatus: "rejected",
      }),
    ).toEqual([withRejected[3]]);
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
    ).toHaveLength(3);
  });
});

describe("sortMembersByDirectoryOrder", () => {
  it("orders leadership by org hierarchy, then status, then name", () => {
    const engagement = buildEngagementLookup([
      { member_id: 10, status: "idle" },
      { member_id: 11, status: "active" },
      { member_id: 12, status: "active" },
    ]);
    const roster = [
      member({
        id: 10,
        full_name: "Zoe Idle",
        role: "general",
        position: "member",
      }),
      member({
        id: 11,
        full_name: "Ann Active",
        role: "general",
        position: "member",
      }),
      member({
        id: 12,
        full_name: "Ben Board",
        role: "board",
        position: "member",
      }),
      member({
        id: 13,
        full_name: "Sam Secretary",
        role: "board",
        position: "secretary",
      }),
      member({
        id: 16,
        full_name: "Tina Treasurer",
        role: "treasurer",
        position: "treasurer",
      }),
      member({
        id: 14,
        full_name: "Pat President",
        role: "president",
        position: "president",
      }),
      member({
        id: 15,
        full_name: "Vic VP",
        role: "board",
        position: "vice_president",
      }),
    ];

    expect(
      sortMembersByDirectoryOrder(roster, engagement).map((m) => m.full_name),
    ).toEqual([
      "Pat President",
      "Vic VP",
      "Sam Secretary",
      "Tina Treasurer",
      "Ben Board",
      "Ann Active",
      "Zoe Idle",
    ]);
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
      boardCount: 0,
      outstandingDuesCount: 4,
      outstandingDuesAmount: 0,
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
