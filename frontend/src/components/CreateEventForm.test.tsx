import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateEventForm } from "./CreateEventForm";
import { createMockEventResponse } from "../test/test-utils";

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

function generatedChecklist() {
  return {
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
  };
}

function mockCreatedEvent() {
  mockedCreateEvent.mockResolvedValue(
    createMockEventResponse({
      id: 12,
      name: "Dashain Celebration",
      created_by_id: 2,
    }),
  );
  mockedAddPrepTaskToEvent.mockResolvedValue({
    id: 1,
    group_name: "Setup",
    due_date: "2030-05-20T12:00:00+00:00",
    assignee_id: null,
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
  });
}

async function fillEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "New event" }));
  await user.type(screen.getByLabelText("Event name"), "Dashain Celebration");
  await user.type(screen.getByLabelText(/Description/), "Annual cultural night.");
  await user.selectOptions(screen.getByLabelText("Event type"), "cultural");
  await user.type(screen.getByLabelText("Date"), "2030-06-01");
  await user.clear(screen.getByLabelText("Start time"));
  await user.type(screen.getByLabelText("Start time"), "18:00");
}

describe("CreateEventForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("expands and validates required fields", async () => {
    const user = userEvent.setup();

    render(<CreateEventForm onCreated={vi.fn()} />);

    expect(screen.getByTestId("create-event-card")).toHaveClass("ds-card");

    await user.click(screen.getByRole("button", { name: "New event" }));
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByText("Event name is required")).toBeInTheDocument();
    expect(screen.getByText("Event date is required")).toBeInTheDocument();
    expect(screen.queryByText("Description is required")).not.toBeInTheDocument();
    expect(
      screen.getByText("Please fill in the required fields highlighted below."),
    ).toBeInTheDocument();
    expect(mockedCreateEvent).not.toHaveBeenCalled();
  });

  it("submits a valid event", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    mockedCreateEvent.mockResolvedValue(
      createMockEventResponse({
        id: 9,
        name: "Spring Social",
        starts_at: "2030-06-15T18:00:00+00:00",
        event_type: "social",
        description: "Food and games.",
        budget: "125.50",
        created_by_id: 2,
      }),
    );

    render(<CreateEventForm onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "New event" }));
    await user.type(screen.getByLabelText("Event name"), "Spring Social");
    await user.type(screen.getByLabelText(/Description/), "Food and games.");
    await user.selectOptions(screen.getByLabelText("Event type"), "social");
    await user.clear(screen.getByLabelText(/Budget \(USD\)/));
    await user.type(screen.getByLabelText(/Budget \(USD\)/), "125.5");
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

  it("tells the organizer when the event is created but checklist tasks fail", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    mockedGenerateEventChecklist.mockResolvedValue(generatedChecklist());
    mockCreatedEvent();
    mockedAddPrepTaskToEvent.mockRejectedValue(new Error("task save failed"));

    render(<CreateEventForm embedded onCreated={onCreated} />);
    await user.type(screen.getByLabelText("Event name"), "Dashain Celebration");
    await user.type(screen.getByLabelText(/Description/), "Annual cultural night.");
    await user.selectOptions(screen.getByLabelText("Event type"), "cultural");
    await user.type(screen.getByLabelText("Date"), "2030-06-01");
    await user.clear(screen.getByLabelText("Start time"));
    await user.type(screen.getByLabelText("Start time"), "18:00");
    await user.click(screen.getByRole("button", { name: "Generate Checklist" }));
    expect(await screen.findByText(/5 tasks across 2 categories/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Create event with checklist tasks" }),
    );

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 12 }),
        expect.stringContaining(
          "Event created, but the checklist was not fully saved",
        ),
      );
    });
    expect(mockedCreateEvent).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("region", { name: "Checklist draft" }),
    ).not.toBeInTheDocument();
  });

  it("generates and attaches checklist tasks when creating an event", async () => {
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
    mockedCreateEvent.mockResolvedValue(
      createMockEventResponse({
        id: 12,
        name: "Dashain Celebration",
        created_by_id: 2,
      }),
    );
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
    await user.type(
      screen.getByLabelText(/Description/),
      "Annual cultural night.",
    );
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
      screen.getByRole("button", { name: "Create event with checklist tasks" }),
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

  it("submits the edited checklist instead of the original AI response", async () => {
    const user = userEvent.setup();
    mockCreatedEvent();
    mockedGenerateEventChecklist.mockResolvedValue(generatedChecklist());

    render(<CreateEventForm onCreated={vi.fn()} />);
    await fillEvent(user);
    await user.click(screen.getByRole("button", { name: "Generate Checklist" }));
    expect(await screen.findByText(/5 tasks across 2 categories/)).toBeInTheDocument();

    const firstItem = screen.getByRole("textbox", { name: "Category 1 item 1" });
    await user.clear(firstItem);
    await user.type(firstItem, "Book the auditorium");
    await user.clear(screen.getByRole("textbox", { name: "Category 1" }));
    await user.type(screen.getByRole("textbox", { name: "Category 1" }), "Room setup");

    await user.click(
      screen.getByRole("button", { name: "Create event with checklist tasks" }),
    );

    await waitFor(() => {
      expect(mockedAddPrepTaskToEvent).toHaveBeenCalledTimes(2);
    });
    expect(mockedAddPrepTaskToEvent).toHaveBeenNthCalledWith(
      1,
      12,
      expect.objectContaining({
        group_name: "Room setup",
        checklist_items: ["Book the auditorium", "Test AV", "Print sign-in sheet"],
      }),
    );
    expect(mockedAddPrepTaskToEvent).not.toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        checklist_items: ["Reserve room", "Test AV", "Print sign-in sheet"],
      }),
    );
  });

  it("adds, removes, and reorders categories and items before create", async () => {
    const user = userEvent.setup();
    mockCreatedEvent();
    mockedGenerateEventChecklist.mockResolvedValue(generatedChecklist());

    render(<CreateEventForm onCreated={vi.fn()} />);
    await fillEvent(user);
    await user.click(screen.getByRole("button", { name: "Generate Checklist" }));
    expect(await screen.findByText(/5 tasks across 2 categories/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Remove category 1 item 3" }),
    );
    expect(screen.getByText(/4 tasks across 2 categories/)).toBeInTheDocument();
    expect(screen.getByText(/Ready to create event with 4 checklist tasks/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add item to category 1" }));
    await user.type(
      screen.getByRole("textbox", { name: "Category 1 item 3" }),
      "Order snacks",
    );
    expect(screen.getByText(/5 tasks across 2 categories/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Move category 1 item 2 up" }),
    );
    await user.click(screen.getByRole("button", { name: "Remove category 2" }));
    expect(screen.getByText(/3 tasks across 1 category/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add category" }));
    await user.type(screen.getByRole("textbox", { name: "Category 2" }), "Programs");
    await user.type(
      screen.getByRole("textbox", { name: "Category 2 item 1" }),
      "Invite speakers",
    );
    await user.click(screen.getByRole("button", { name: "Move category 2 up" }));
    expect(
      screen.getByRole("button", { name: "Move category 1 up" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Create event with checklist tasks" }),
    );

    await waitFor(() => {
      expect(mockedAddPrepTaskToEvent).toHaveBeenCalledTimes(2);
    });
    expect(mockedAddPrepTaskToEvent).toHaveBeenNthCalledWith(
      1,
      12,
      expect.objectContaining({
        group_name: "Programs",
        checklist_items: ["Invite speakers"],
      }),
    );
    expect(mockedAddPrepTaskToEvent).toHaveBeenNthCalledWith(
      2,
      12,
      expect.objectContaining({
        group_name: "Setup",
        checklist_items: ["Test AV", "Reserve room", "Order snacks"],
      }),
    );
  });

  it("builds a manual checklist without calling AI", async () => {
    const user = userEvent.setup();
    mockCreatedEvent();

    render(<CreateEventForm onCreated={vi.fn()} />);
    await fillEvent(user);
    await user.click(screen.getByRole("button", { name: "Build manually" }));
    expect(screen.getByText(/1 task across 1 category/)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Category 1" }), "Venue");
    await user.type(
      screen.getByRole("textbox", { name: "Category 1 item 1" }),
      "  Reserve the hall  ",
    );
    await user.click(
      screen.getByRole("button", { name: "Create event with checklist tasks" }),
    );

    await waitFor(() => {
      expect(mockedCreateEvent).toHaveBeenCalled();
    });
    expect(mockedGenerateEventChecklist).not.toHaveBeenCalled();
    expect(mockedAddPrepTaskToEvent).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        group_name: "Venue",
        checklist_items: ["Reserve the hall"],
      }),
    );
  });

  it("confirms before clearing and before replacing edited checklist text", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockedGenerateEventChecklist.mockResolvedValue(generatedChecklist());

    render(<CreateEventForm onCreated={vi.fn()} />);
    await fillEvent(user);
    await user.click(screen.getByRole("button", { name: "Generate Checklist" }));
    expect(await screen.findByDisplayValue("Reserve room")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Generate Checklist" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(mockedGenerateEventChecklist).toHaveBeenCalledTimes(2);

    const firstItem = screen.getByRole("textbox", { name: "Category 1 item 1" });
    await user.clear(firstItem);
    await user.type(firstItem, "Book the auditorium");

    await user.click(screen.getByRole("button", { name: "Generate Checklist" }));
    expect(confirm).toHaveBeenCalledWith(
      "Replace this checklist? Generating again will overwrite your edits.",
    );
    expect(screen.getByDisplayValue("Book the auditorium")).toBeInTheDocument();
    expect(mockedGenerateEventChecklist).toHaveBeenCalledTimes(2);

    confirm.mockReturnValue(true);
    mockedGenerateEventChecklist.mockResolvedValueOnce({
      categories: [{ category: "Promotion", tasks: ["Design poster"] }],
    });
    await user.click(screen.getByRole("button", { name: "Generate Checklist" }));
    expect(await screen.findByDisplayValue("Design poster")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Book the auditorium")).not.toBeInTheDocument();

    confirm.mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(confirm).toHaveBeenCalledWith(
      "Clear this checklist? This removes every category and item.",
    );
    expect(screen.getByDisplayValue("Design poster")).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(
      screen.queryByRole("region", { name: "Checklist draft" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build manually" })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("blocks create when a category or item is empty", async () => {
    const user = userEvent.setup();
    mockCreatedEvent();

    render(<CreateEventForm onCreated={vi.fn()} />);
    await fillEvent(user);
    await user.click(screen.getByRole("button", { name: "Build manually" }));
    await user.click(screen.getByRole("button", { name: "Create event with checklist tasks" }));

    expect(
      await screen.findByText(
        "Fix the highlighted checklist fields before creating the event.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Category name is required")).toBeInTheDocument();
    expect(screen.getByText("Checklist item is required")).toBeInTheDocument();
    expect(mockedCreateEvent).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: "Category 1" }), "   ");
    await user.type(screen.getByRole("textbox", { name: "Category 1 item 1" }), "   ");
    await user.click(screen.getByRole("button", { name: "Create event with checklist tasks" }));

    expect(screen.getByText("Category name is required")).toBeInTheDocument();
    expect(mockedCreateEvent).not.toHaveBeenCalled();
  });
});
