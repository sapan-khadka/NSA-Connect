import { describe, expect, it } from "vitest";

import {
  buildCategoryDueDate,
  buildPrepTaskCreates,
} from "./prep-task-create";

describe("prep-task-create", () => {
  it("builds staggered due dates before the event", () => {
    const first = buildCategoryDueDate("2030-06-15", "18:00", 0, 3);
    const last = buildCategoryDueDate("2030-06-15", "18:00", 2, 3);

    expect(new Date(first).getTime()).toBeLessThan(new Date(last).getTime());
    expect(new Date(last).getTime()).toBeLessThan(
      new Date("2030-06-15T18:00:00").getTime(),
    );
  });

  it("maps generated categories to prep task payloads", () => {
    const payloads = buildPrepTaskCreates(
      [
        {
          category: "Setup",
          tasks: ["Reserve room", "Test AV"],
        },
      ],
      "2030-06-15",
      "18:00",
    );

    expect(payloads).toHaveLength(1);
    expect(payloads[0].group_name).toBe("Setup");
    expect(payloads[0].checklist_items).toEqual(["Reserve room", "Test AV"]);
    expect(payloads[0].due_date).toMatch(/2030-06-/);
  });
});
