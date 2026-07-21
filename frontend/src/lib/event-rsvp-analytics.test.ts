import { describe, expect, it } from "vitest";

import { computeRsvpAnalytics } from "./event-rsvp-analytics";

describe("computeRsvpAnalytics", () => {
  it("derives prediction and response-going share from RSVP counts", () => {
    const result = computeRsvpAnalytics(
      {
        going_count: 80,
        maybe_count: 20,
        not_going_count: 10,
        no_response_count: 5,
      },
      null,
    );

    expect(result?.going).toBe(80);
    expect(result?.maybe).toBe(20);
    expect(result?.declined).toBe(10);
    expect(result?.attendancePrediction).toBe(90);
    expect(result?.responseGoingPercent).toBe(73);
    expect(result?.capacityFilledPercent).toBeNull();
    expect(result?.noShowRatePercent).toBeNull();
  });

  it("uses event capacity for capacity filled percent", () => {
    const result = computeRsvpAnalytics(
      {
        going_count: 60,
        maybe_count: 10,
        not_going_count: 0,
        no_response_count: 0,
      },
      null,
      100,
    );

    expect(result?.capacityFilledPercent).toBe(60);
    expect(result?.responseGoingPercent).toBe(86);
  });

  it("computes no-show rate from attendance summary", () => {
    const result = computeRsvpAnalytics(
      {
        going_count: 6,
        maybe_count: 0,
        not_going_count: 0,
        no_response_count: 0,
      },
      {
        event_id: 1,
        event_name: "Dashain",
        going_attended: { count: 4, members: [] },
        going_no_show: { count: 2, members: [] },
        walk_ins: { count: 0, members: [] },
        not_going: { count: 0, members: [] },
        guests_checked_in: { count: 0 },
      },
    );

    expect(result?.noShowRatePercent).toBe(33);
  });
});
