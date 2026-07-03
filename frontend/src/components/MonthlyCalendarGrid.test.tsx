import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventsCalendarPanel } from "./EventsCalendarPanel";
import type { CalendarEventInput } from "../lib/calendar-events";
import type { EventResponse } from "../lib/events-api";

const defaultProps = {
  viewMode: "month" as const,
  onViewModeChange: vi.fn(),
  year: 2030,
  month: 5,
  onMonthChange: vi.fn(),
  selectedDate: null,
  onSelectDate: vi.fn(),
  monthEvents: [] as CalendarEventInput[],
  yearEvents: [] as CalendarEventInput[],
  searchQuery: "",
  onSearchQueryChange: vi.fn(),
  searchResults: [] as EventResponse[],
  onSelectSearchResult: vi.fn(),
};

describe("EventsCalendarPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders weekday headers and June 2030 days", () => {
    render(<EventsCalendarPanel {...defaultProps} />);

    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-month-label")).toHaveTextContent("June");
    expect(screen.getByTestId("calendar-month-label")).toHaveTextContent("2030");
    expect(screen.getByRole("button", { name: "2030-06-01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2030-06-30" })).toBeInTheDocument();
  });

  it("navigates months via chevron controls", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();

    render(
      <EventsCalendarPanel
        {...defaultProps}
        onMonthChange={onMonthChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(onMonthChange).toHaveBeenCalledWith(2030, 4);

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenCalledWith(2030, 6);
  });

  it("renders category dots on event days and legend", () => {
    render(
      <EventsCalendarPanel
        {...defaultProps}
        monthEvents={[
          {
            starts_at: "2030-06-15T18:00:00+00:00",
            event_type: "cultural",
          },
          {
            starts_at: "2030-06-15T20:00:00+00:00",
            event_type: "meeting",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Event type legend")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "2030-06-15, Cultural, Meeting" }),
    ).toBeInTheDocument();

    const dayCell = screen.getByRole("button", {
      name: "2030-06-15, Cultural, Meeting",
    });
    const dots = dayCell.querySelector('[data-testid="calendar-category-dots"]');
    expect(dots?.querySelector(".bg-\\[\\#D85A30\\]")).toBeTruthy();
    expect(dots?.querySelector(".bg-\\[\\#378ADD\\]")).toBeTruthy();
  });

  it("shows Bikram Sambat labels for current-month days", () => {
    render(<EventsCalendarPanel {...defaultProps} />);

    const juneFirst = screen.getByRole("button", { name: /^2030-06-01/ });
    expect(juneFirst.textContent).toMatch(/\d{1,2} \w+/);
  });

  it("highlights festival days without NSA events", () => {
    render(<EventsCalendarPanel {...defaultProps} month={2} year={2030} />);

    const holiCell = screen.getByRole("button", { name: /2030-03-20, Holi/ });
    const dots = holiCell.querySelector('[data-testid="calendar-category-dots"]');
    expect(dots?.querySelector(".bg-\\[\\#7F77DD\\]")).toBeTruthy();
    expect(screen.getAllByText("Nepali festival").length).toBeGreaterThan(0);
  });

  it("selects a date when clicked", async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();

    render(
      <EventsCalendarPanel
        {...defaultProps}
        onSelectDate={onSelectDate}
        monthEvents={[
          {
            starts_at: "2030-06-15T18:00:00+00:00",
            event_type: "cultural",
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "2030-06-15, Cultural" }),
    );
    expect(onSelectDate).toHaveBeenCalledWith("2030-06-15");
  });

  it("switches to year view from the toggle", async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();

    render(
      <EventsCalendarPanel
        {...defaultProps}
        onViewModeChange={onViewModeChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "year" }));
    expect(onViewModeChange).toHaveBeenCalledWith("year");
  });

  it("selects a month tile in year view", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    const onViewModeChange = vi.fn();

    render(
      <EventsCalendarPanel
        {...defaultProps}
        viewMode="year"
        onMonthChange={onMonthChange}
        onViewModeChange={onViewModeChange}
        yearEvents={[
          {
            starts_at: "2030-08-10T18:00:00+00:00",
            event_type: "social",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "August" }));
    expect(onMonthChange).toHaveBeenCalledWith(2030, 7);
    expect(onViewModeChange).toHaveBeenCalledWith("month");
  });
});
