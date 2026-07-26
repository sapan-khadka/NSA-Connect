import { describe, expect, it } from "vitest";

import { computeEventHealth } from "./event-health";

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
  });

  it("marks budget overspend as at risk", () => {
    const result = computeEventHealth({
      ...base,
      budgetSpent: 150,
      budgetCap: 100,
    });
    expect(result.level).toBe("at_risk");
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
  });

  it("suggests assigning volunteers when short", () => {
    const result = computeEventHealth({
      ...base,
      volunteersFilled: 2,
      volunteersNeeded: 6,
    });
    expect(result.level).toBe("needs_attention");
    expect(result.nextMilestone).toBe("Assign 4 volunteers");
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
  });
});
