import { describe, expect, it } from "vitest";

import { computeEventHealth, eventHealthManageHref } from "./event-health";

const base = {
  preparationPct: 75,
  checklistDone: 6,
  checklistTotal: 8,
  overdueTasks: 0,
  budgetSpent: 0,
  budgetCap: 100,
  volunteersFilled: 3,
  volunteersNeeded: 6,
  volunteersTargetSet: true,
};

describe("computeEventHealth", () => {
  it("marks overdue work as at risk", () => {
    const result = computeEventHealth({ ...base, overdueTasks: 1 });
    expect(result.level).toBe("at_risk");
    expect(result.label).toBe("At Risk");
    expect(result.nextMilestone).toBe("Review 1 overdue task");
    expect(result.action).toBe("tasks");
  });

  it("marks budget overspend as at risk", () => {
    const result = computeEventHealth({
      ...base,
      budgetSpent: 150,
      budgetCap: 100,
    });
    expect(result.level).toBe("at_risk");
    expect(result.nextMilestone).toBe("Review budget");
    expect(result.action).toBe("budget");
  });

  it("asks for volunteer targets when unset", () => {
    const result = computeEventHealth({
      ...base,
      volunteersTargetSet: false,
      volunteersFilled: 0,
      volunteersNeeded: 0,
    });
    expect(result.level).toBe("needs_attention");
    expect(result.nextMilestone).toBe("Set volunteer targets");
    expect(result.action).toBe("volunteers");
  });

  it("suggests assigning volunteers when short", () => {
    const result = computeEventHealth({
      ...base,
      volunteersFilled: 2,
      volunteersNeeded: 6,
    });
    expect(result.level).toBe("needs_attention");
    expect(result.nextMilestone).toBe("Assign 4 volunteers");
    expect(result.action).toBe("volunteers");
  });

  it("returns on track with a checklist next step", () => {
    const result = computeEventHealth({
      ...base,
      preparationPct: 70,
      checklistDone: 7,
      checklistTotal: 10,
      volunteersFilled: 6,
      volunteersNeeded: 6,
    });
    expect(result.level).toBe("on_track");
    expect(result.nextMilestone).toBe("Complete 3 checklist items");
    expect(result.action).toBe("tasks");
  });

  it("returns excellent when prep and volunteers are solid", () => {
    const result = computeEventHealth({
      ...base,
      preparationPct: 95,
      checklistDone: 19,
      checklistTotal: 20,
      volunteersFilled: 6,
      volunteersNeeded: 6,
    });
    expect(result.level).toBe("excellent");
    expect(result.nextMilestone).toBeNull();
    expect(result.action).toBeNull();
  });
});

describe("eventHealthManageHref", () => {
  it("deep-links overdue work to the tasks modal", () => {
    expect(eventHealthManageHref(7, "tasks")).toBe(
      "/events/7/manage?tab=operations&modal=tasks",
    );
  });

  it("opens operations for volunteer and budget follow-up", () => {
    expect(eventHealthManageHref(7, "volunteers")).toBe(
      "/events/7/manage?tab=operations",
    );
    expect(eventHealthManageHref(7, "budget")).toBe(
      "/events/7/manage?tab=operations",
    );
  });
});
