import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateEventForm } from "./CreateEventForm";

vi.mock("../lib/events-api", () => ({
  createEvent: vi.fn(),
  addPrepTaskToEvent: vi.fn(),
}));

vi.mock("../lib/ai-api", () => ({
  generateEventChecklist: vi.fn(),
  countChecklistTasks: (categories: { tasks: string[] }[]) =>
    categories.reduce((total, category) => total + category.tasks.length, 0),
}));

import { generateEventChecklist } from "../lib/ai-api";
import { addPrepTaskToEvent, createEvent } from "../lib/events-api";

const mockedCreateEvent = vi.mocked(createEvent);
const mockedAddPrepTaskToEvent = vi.mocked(addPrepTaskToEvent);
const mockedGenerateEventChecklist = vi.mocked(generateEventChecklist);

describe("CreateEventForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("expands and validates required fields", async () => {
    const user = userEvent.setup();

    render(<CreateEventForm onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "New event" }));
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByText("Event name is required")).toBeInTheDocument();
    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(screen.getByText("Event date is required")).toBeInTheDocument();
    expect(mockedCreateEvent).not.toHaveBeenCalled();
  });

  it("submits a valid event", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    mockedCreateEvent.mockResolvedValue({
      id: 9,
      name: "Spring Social",
      starts_at: "2030-06-15T18:00:00+00:00",
      event_type: "social",
      description: "Food and games.",
      budget: "125.50",
      created_by_id: 2,
      rsvp_count: 0,
      current_member_has_rsvped: false,
    });

    render(<CreateEventForm onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "New event" }));
    await user.type(screen.getByLabelText("Event name"), "Spring Social");
    await user.type(screen.getByLabelText("Description"), "Food and games.");
    await user.selectOptions(screen.getByLabelText("Event type"), "social");
    await user.clear(screen.getByLabelText("Budget (USD)"));
    await user.type(screen.getByLabelText("Budget (USD)"), "125.5");
    await user.type(screen.getByLabelText("Date"), "2030-06-15");
    await user.type(screen.getByLabelText("Start time"), "18:00");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => {
      expect(mockedCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Spring Social",
          description: "Food and games.",
          event_type: "social",
          budget: "125.50",
        }),
      );
    });

    expect(onCreated).toHaveBeenCalled();
    expect(mockedAddPrepTaskToEvent).not.toHaveBeenCalled();
  });

  it("generates and attaches prep tasks when creating an event", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    mockedGenerateEventChecklist.mockResolvedValue({
      categories: [
        {
          category: "Setup",
          tasks: ["Reserve room", "Test AV", "Print sign-in sheet"],
        },
        {
          category: "Food & Beverage",
          tasks: ["Order catering", "Confirm dietary restrictions"],
        },
      ],
    });
    mockedCreateEvent.mockResolvedValue({
      id: 12,
      name: "Dashain Celebration",
      starts_at: "2030-06-01T18:00:00+00:00",
      event_type: "cultural",
      description: "Annual cultural night.",
      budget: "250.00",
      created_by_id: 2,
      rsvp_count: 0,
      current_member_has_rsvped: false,
    });
    mockedAddPrepTaskToEvent.mockResolvedValue({
      id: 1,
      group_name: "Setup",
      due_date: "2030-05-20T12:00:00+00:00",
      assignee_id: null,
      is_overdue: false,
      is_complete: false,
      checklist_items: [],
    });

    render(<CreateEventForm onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "New event" }));
    await user.type(screen.getByLabelText("Event name"), "Dashain Celebration");
    await user.type(screen.getByLabelText("Description"), "Annual cultural night.");
    await user.selectOptions(screen.getByLabelText("Event type"), "cultural");
    await user.type(screen.getByLabelText("Date"), "2030-06-01");
    await user.clear(screen.getByLabelText("Start time"));
    await user.type(screen.getByLabelText("Start time"), "18:00");
    await user.click(
      screen.getByRole("button", { name: "Generate Checklist" }),
    );

    expect(await screen.findByText(/5 tasks across 2 categories/)).toBeInTheDocument();
    expect(mockedGenerateEventChecklist).toHaveBeenCalledWith({
      event_name: "Dashain Celebration",
      event_type: "cultural",
    });

    await user.click(
      screen.getByRole("button", { name: "Create event with prep tasks" }),
    );

    await waitFor(() => {
      expect(mockedCreateEvent).toHaveBeenCalled();
    });
    expect(mockedAddPrepTaskToEvent).toHaveBeenCalledTimes(2);
    expect(mockedAddPrepTaskToEvent).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        group_name: "Setup",
        checklist_items: ["Reserve room", "Test AV", "Print sign-in sheet"],
      }),
    );
    expect(onCreated).toHaveBeenCalled();
  });
});
