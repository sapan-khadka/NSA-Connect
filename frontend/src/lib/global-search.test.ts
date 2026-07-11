import { describe, expect, it } from "vitest";

import { filterGlobalSearch, groupGlobalSearchResults } from "./global-search";
import type { MemberResponse } from "./auth-api";
import type { EventResponse } from "./events-api";
import type { Announcement } from "./announcements-api";
import type { FinanceEntryResponse } from "./finance-api";

function member(partial: Partial<MemberResponse> & Pick<MemberResponse, "id" | "full_name">): MemberResponse {
  return {
    email: "a@example.com",
    student_id: "S1",
    major: "CS",
    role: "general",
    status: "approved",
    graduation_year: 2027,
    interests: "",
    talents: [],
    talent_other: null,
    ...partial,
  } as MemberResponse;
}

describe("filterGlobalSearch", () => {
  it("matches across categories", () => {
    const results = filterGlobalSearch(
      {
        members: [member({ id: 1, full_name: "Ada Lovelace" })],
        events: [
          {
            id: 2,
            name: "Dashain Night",
            description: "Celebration",
            location: "Hall",
            event_type: "cultural",
            starts_at: "2030-01-01T00:00:00Z",
          } as EventResponse,
        ],
        announcements: [
          {
            id: 3,
            title: "Dashain schedule",
            body: "Details soon",
            category: "general",
          } as Announcement,
        ],
        transactions: [
          {
            id: 4,
            description: "Catering deposit",
            category: "food",
            entry_type: "expense",
            amount: "120.00",
          } as FinanceEntryResponse,
        ],
      },
      "dashain",
    );

    expect(results.map((item) => item.category)).toEqual([
      "event",
      "announcement",
    ]);
    expect(groupGlobalSearchResults(results)).toHaveLength(2);
  });

  it("returns empty for blank queries", () => {
    expect(
      filterGlobalSearch(
        { members: [], events: [], announcements: [], transactions: [] },
        "   ",
      ),
    ).toEqual([]);
  });
});
