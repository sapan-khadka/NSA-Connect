import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BoardTaskKanban } from "./BoardTaskKanban";
import type { KanbanTask } from "../../lib/kanban-status";

vi.mock("@dnd-kit/core", async () => {
  const actual = await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

const tasks: KanbanTask[] = [
  {
    id: 1,
    event_id: 5,
    event_name: "Dashain Celebration",
    task_kind: "checklist",
    title: "Setup",
    group_name: "Setup",
    description: "",
    assignee_id: null,
    assignee_name: null,
    status: "todo",
    due_date: "2030-05-20T12:00:00+00:00",
    is_overdue: false,
    is_complete: false,
    checklist_items: [
      { id: 10, label: "Reserve room", is_completed: false, sort_order: 0 },
    ],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: null,
    created_at: "2030-05-20T12:00:00+00:00",
    eventId: 5,
    eventName: "Dashain Celebration",
    eventStartsAt: "2030-06-01T18:00:00+00:00",
  },
  {
    id: 2,
    event_id: 5,
    event_name: "Dashain Celebration",
    task_kind: "simple",
    title: "Order catering",
    group_name: null,
    description: "",
    assignee_id: 3,
    assignee_name: null,
    status: "in_progress",
    due_date: "2030-05-21T12:00:00+00:00",
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: null,
    created_at: "2030-05-21T12:00:00+00:00",
    eventId: 5,
    eventName: "Dashain Celebration",
    eventStartsAt: "2030-06-01T18:00:00+00:00",
  },
  {
    id: 3,
    event_id: 5,
    event_name: "Dashain Celebration",
    task_kind: "checklist",
    title: "Food & Beverage",
    group_name: "Food & Beverage",
    description: "",
    assignee_id: 3,
    assignee_name: null,
    status: "done",
    due_date: "2030-05-21T12:00:00+00:00",
    is_overdue: false,
    is_complete: true,
    checklist_items: [
      { id: 20, label: "Order catering", is_completed: true, sort_order: 0 },
    ],
    completion_note: null,
    completion_photo_url: null,
    completed_at: "2030-05-21T12:00:00+00:00",
    created_by_id: null,
    created_at: "2030-05-21T12:00:00+00:00",
    eventId: 5,
    eventName: "Dashain Celebration",
    eventStartsAt: "2030-06-01T18:00:00+00:00",
  },
];

describe("BoardTaskKanban", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders three kanban columns with color-coded headers and task cards", () => {
    render(
      <MemoryRouter>
        <BoardTaskKanban tasks={tasks} onMoveTask={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /To do\s·\s1/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /In progress\s·\s1/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Done\s·\s1/ })).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Order catering")).toBeInTheDocument();
    expect(screen.getByText("Food & Beverage")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-kanban-column="todo"]')).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "+ Add task" })).toHaveLength(3);
  });

  it("styles in-progress cards without ds-card focus-outline classes", () => {
    render(
      <MemoryRouter>
        <BoardTaskKanban tasks={tasks} onMoveTask={vi.fn()} />
      </MemoryRouter>,
    );

    const card = screen.getByText("Order catering").closest("article");
    expect(card).not.toHaveClass("ds-card");
    expect(card).not.toHaveClass("ds-card-interactive");
    expect(card).toHaveClass("focus-visible:outline-none");
  });

  it("renders filled open-details buttons on task cards", () => {
    render(
      <MemoryRouter>
        <BoardTaskKanban tasks={tasks} onMoveTask={vi.fn()} onOpenTask={vi.fn()} />
      </MemoryRouter>,
    );

    const buttons = screen.getAllByRole("button", { name: "Open details" });
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toHaveClass("text-white");
      expect(button).not.toHaveClass("border");
    }
  });
});
