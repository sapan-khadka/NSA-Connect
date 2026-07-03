import { describe, expect, it } from "vitest";

import { getKanbanColumnTheme, KANBAN_COLUMN_THEMES } from "./kanban-theme";

describe("kanban-theme", () => {
  it("defines solid header colors per column", () => {
    expect(KANBAN_COLUMN_THEMES.todo.headerBg).toBe("#475569");
    expect(KANBAN_COLUMN_THEMES.in_progress.headerBg).toBe("#E8A94D");
    expect(KANBAN_COLUMN_THEMES.done.headerBg).toBe("#027C68");
  });

  it("defines gradient card backgrounds for active columns", () => {
    expect(getKanbanColumnTheme("in_progress").cardGradient).toContain("#FCF1E4");
    expect(getKanbanColumnTheme("done").cardGradient).toContain("#EFF9F3");
    expect(getKanbanColumnTheme("todo").emptyBg).toBe("#F8FAFC");
  });
});
