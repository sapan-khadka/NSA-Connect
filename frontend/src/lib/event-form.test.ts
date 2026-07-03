import { describe, expect, it } from "vitest";

import {
  buildCreateEventPayload,
  combineDateAndTime,
  EVENT_DATE_PAST_ERROR,
  getMinEventDate,
  isEventDateBeforeToday,
  validateCreateEventForm,
} from "./event-form";

describe("event form", () => {
  it("combines local date and time with timezone offset", () => {
    const iso = combineDateAndTime("2030-06-15", "18:00");
    expect(iso).toMatch(/^2030-06-15T18:00:00[+-]\d{2}:\d{2}$/);
  });

  it("validates required fields", () => {
    const errors = validateCreateEventForm({
      name: "",
      description: "",
      event_type: "cultural",
      event_date: "",
      event_time: "",
      budget: "",
    });

    expect(errors.name).toBeTruthy();
    expect(errors.description).toBeTruthy();
    expect(errors.event_date).toBeTruthy();
  });

  it("treats budget as optional and defaults an empty value to 0.00", () => {
    const errors = validateCreateEventForm({
      name: "Spring Social",
      description: "Food and games.",
      event_type: "social",
      event_date: "2030-06-15",
      event_time: "18:00",
      budget: "",
    });

    expect(errors.budget).toBeUndefined();

    const payload = buildCreateEventPayload({
      name: "Spring Social",
      description: "Food and games.",
      event_type: "social",
      event_date: "2030-06-15",
      event_time: "18:00",
      budget: "",
    });

    expect(payload.budget).toBe("0.00");
  });

  it("still rejects a malformed budget when one is provided", () => {
    expect(
      validateCreateEventForm({
        name: "Spring Social",
        description: "Food and games.",
        event_type: "social",
        event_date: "2030-06-15",
        event_time: "18:00",
        budget: "12.999",
      }).budget,
    ).toBeTruthy();
  });

  it("builds API payload with trimmed values and formatted budget", () => {
    const payload = buildCreateEventPayload({
      name: "  Spring Social  ",
      description: "  Food and games.  ",
      event_type: "social",
      event_date: "2030-06-15",
      event_time: "18:00",
      budget: "125.5",
    });

    expect(payload.name).toBe("Spring Social");
    expect(payload.description).toBe("Food and games.");
    expect(payload.event_type).toBe("social");
    expect(payload.budget).toBe("125.50");
    expect(payload.starts_at).toContain("2030-06-15T18:00:00");
  });

  it("rejects event dates before today", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = getMinEventDate(yesterday);

    expect(isEventDateBeforeToday(pastDate, new Date())).toBe(true);
    expect(
      validateCreateEventForm({
        name: "Spring Social",
        description: "Food and games.",
        event_type: "social",
        event_date: pastDate,
        event_time: "18:00",
        budget: "",
      }).event_date,
    ).toBe(EVENT_DATE_PAST_ERROR);
  });

  it("allows today's date even when the time has passed", () => {
    const today = getMinEventDate();

    expect(
      validateCreateEventForm({
        name: "Tonight's event",
        description: "Still schedulable today.",
        event_type: "cultural",
        event_date: today,
        event_time: "00:01",
        budget: "",
      }).event_date,
    ).toBeUndefined();
  });
});
