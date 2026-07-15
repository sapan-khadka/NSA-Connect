import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EventResponse } from "./events-api";
import {
  fetchEventAttendees,
  fetchEventVolunteerSignups,
  fetchUpcomingEvents,
} from "./events-api";
import { fetchMeetings } from "./meetings-api";
import {
  commitmentFromMeeting,
  commitmentFromMyVolunteerSignup,
  commitmentFromUpcomingRsvp,
  fetchMemberWorkspaceSchedule,
  formatScheduleWhen,
  takeSchedulePreview,
} from "./member-workspace-schedule";
import { fetchMyVolunteerSignups } from "./volunteer-api";

vi.mock("./events-api", () => ({
  fetchUpcomingEvents: vi.fn(),
  fetchEventAttendees: vi.fn(),
  fetchEventVolunteerSignups: vi.fn(),
}));

vi.mock("./volunteer-api", () => ({
  fetchMyVolunteerSignups: vi.fn(),
}));

vi.mock("./meetings-api", () => ({
  fetchMeetings: vi.fn(),
}));

const mockedUpcoming = vi.mocked(fetchUpcomingEvents);
const mockedAttendees = vi.mocked(fetchEventAttendees);
const mockedVolunteers = vi.mocked(fetchEventVolunteerSignups);
const mockedMyVolunteers = vi.mocked(fetchMyVolunteerSignups);
const mockedMeetings = vi.mocked(fetchMeetings);
function makeEvent(overrides: Partial<EventResponse> = {}): EventResponse {
  return {
    id: 10,
    name: "Dashain Celebration",
    starts_at: "2030-06-15T18:00:00.000Z",
    ends_at: null,
    event_type: "cultural",
    description: "",
    location: null,
    budget: "0",
    created_by_id: 1,
    current_member_rsvp_status: "going",
    finance_lock_at: "2030-06-15T18:00:00.000Z",
    is_finance_locked: false,
    is_past: false,
    is_finance_grace_period: false,
    show_in_photo_archive: false,
    meeting_visibility: null,
    ...overrides,
  };
}

describe("member-workspace-schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats relative when labels", () => {
    const now = new Date("2030-06-14T12:00:00");
    const today = new Date(now);
    today.setHours(18, 0, 0, 0);
    expect(formatScheduleWhen(today.toISOString(), now)).toMatch(/^Today • /);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 0, 0, 0);
    expect(formatScheduleWhen(tomorrow.toISOString(), now)).toMatch(
      /^Tomorrow • /,
    );
  });

  it("builds RSVP commitments only for going/maybe upcoming events", () => {
    const now = new Date("2030-01-01T00:00:00.000Z");
    expect(
      commitmentFromUpcomingRsvp(makeEvent(), "going", now)?.detail,
    ).toBe("Going");
    expect(commitmentFromUpcomingRsvp(makeEvent(), "not_going", now)).toBeNull();
    expect(
      commitmentFromUpcomingRsvp(
        makeEvent({ is_past: true, starts_at: "2020-01-01T00:00:00.000Z" }),
        "going",
        now,
      ),
    ).toBeNull();
  });

  it("builds volunteer and meeting commitments from real fields", () => {
    const now = new Date("2030-01-01T00:00:00.000Z");
    expect(
      commitmentFromMyVolunteerSignup(
        {
          id: 3,
          slot_id: 1,
          task_name: "Check-in table",
          event_id: 10,
          event_name: "Dashain",
          event_starts_at: "2030-06-15T18:00:00.000Z",
          signed_up_at: "2030-05-01T12:00:00.000Z",
          is_done: false,
        },
        now,
      ),
    ).toMatchObject({
      kind: "volunteer",
      title: "Check-in table",
      detail: "Dashain",
    });

    expect(
      commitmentFromMeeting(
        {
          event_id: 22,
          event_name: "April Board Meeting",
          starts_at: "2030-04-10T22:00:00.000Z",
          is_past: false,
          agenda: "",
          has_attendance: false,
          has_minutes: false,
          has_summary: false,
          present_count: 0,
          absent_count: 0,
          excused_count: 0,
          unmarked_count: 0,
          minutes_updated_at: null,
        },
        now,
      ),
    ).toMatchObject({
      kind: "meeting",
      href: "/events/meetings/22",
    });
  });

  it("caps the preview list and reports hasMore", () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      id: `e-${index}`,
      kind: "event" as const,
      kindLabel: "Event",
      title: `Event ${index}`,
      detail: null,
      startsAt: `2030-06-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
      whenLabel: "Soon",
      href: `/events/${index}`,
    }));

    const result = takeSchedulePreview(items, 5);
    expect(result.preview).toHaveLength(5);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(7);
    expect(result.preview[0]?.title).toBe("Event 0");
  });

  it("loads self schedule from RSVP, volunteer, and board meetings", async () => {
    const now = new Date("2030-01-01T00:00:00.000Z");
    mockedUpcoming.mockResolvedValue({
      events: [makeEvent({ current_member_rsvp_status: "maybe" })],
      total: 1,
    });
    mockedMyVolunteers.mockResolvedValue({
      signups: [
        {
          id: 3,
          slot_id: 1,
          task_name: "Check-in table",
          event_id: 10,
          event_name: "Dashain Celebration",
          event_starts_at: "2030-06-15T18:00:00.000Z",
          signed_up_at: "2030-05-01T12:00:00.000Z",
          is_done: false,
        },
      ],
      total: 1,
    });
    mockedMeetings.mockResolvedValue({
      meetings: [
        {
          event_id: 22,
          event_name: "April Board Meeting",
          starts_at: "2030-04-10T22:00:00.000Z",
          is_past: false,
          agenda: "",
          has_attendance: false,
          has_minutes: false,
          has_summary: false,
          present_count: 0,
          absent_count: 0,
          excused_count: 0,
          unmarked_count: 0,
          minutes_updated_at: null,
        },
      ],
      total: 1,
    });

    const schedule = await fetchMemberWorkspaceSchedule({
      memberId: 2,
      memberRole: "board",
      isSelf: true,
      viewerIsBoard: true,
      now,
    });

    expect(schedule.map((item) => item.kind).sort()).toEqual([
      "event",
      "meeting",
      "volunteer",
    ]);
    expect(mockedAttendees).not.toHaveBeenCalled();
    expect(mockedVolunteers).not.toHaveBeenCalled();
  });
});
