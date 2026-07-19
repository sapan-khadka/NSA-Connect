import { describe, expect, it } from "vitest";

import type { EventTaskResponse, TaskOverviewMember } from "./event-tasks-api";
import {
  buildOversightMemberSnapshot,
  classifyOversightHealthStatus,
  classifyOversightWorkload,
  countOverdueTasks,
  filterOverviewMembersByAssigneeCategory,
  filterOverviewMembersByEvent,
  isDueWithinNext48Hours,
  listOversightEvents,
  sortActiveMembers,
  sortOversightSnapshots,
  splitTaskOverviewMembers,
} from "./task-oversight";

function task(
  overrides: Partial<EventTaskResponse> & Pick<EventTaskResponse, "id" | "title">,
): EventTaskResponse {
  return {
    event_id: 1,
    event_name: "Dashain",
    task_kind: "simple",
    group_name: null,
    description: "",
    assignee_id: 1,
    assignee_name: "Alex",
    status: "todo",
    due_date: null,
    is_overdue: false,
    is_complete: false,
    checklist_items: [],
    completion_note: null,
    completion_photo_url: null,
    completed_at: null,
    created_by_id: 1,
    created_at: "2026-03-18T12:00:00Z",
    assignee_has_volunteer_signup: false,
    ...overrides,
  };
}

function member(
  overrides: Partial<TaskOverviewMember> &
    Pick<TaskOverviewMember, "member_id" | "full_name">,
): TaskOverviewMember {
  return {
    role: "board",
    position: "member",
    total: 0,
    completed: 0,
    in_progress: 0,
    todo: 0,
    completion_percent: 0,
    tasks: [],
    ...overrides,
  };
}

describe("task-oversight", () => {
  it("splits members with and without assigned tasks", () => {
    const members = [
      member({ member_id: 1, full_name: "Alex", total: 2 }),
      member({ member_id: 2, full_name: "Blair" }),
      member({ member_id: 3, full_name: "Casey", total: 1 }),
    ];

    expect(splitTaskOverviewMembers(members)).toEqual({
      active: [members[0], members[2]],
      unassigned: [members[1]],
    });
  });

  it("counts overdue open tasks across all members", () => {
    const members = [
      member({
        member_id: 1,
        full_name: "Alex",
        total: 2,
        tasks: [
          task({
            id: 1,
            title: "Late task",
            is_overdue: true,
            is_complete: false,
          }),
          task({
            id: 2,
            title: "Done task",
            status: "done",
            is_overdue: true,
            is_complete: true,
          }),
        ],
      }),
    ];

    expect(countOverdueTasks(members)).toBe(1);
  });

  it("sorts active members by overdue count then completion percent", () => {
    const members = [
      member({
        member_id: 1,
        full_name: "Complete",
        total: 2,
        completion_percent: 100,
        tasks: [],
      }),
      member({
        member_id: 2,
        full_name: "Overdue",
        total: 2,
        completion_percent: 50,
        tasks: [
          task({
            id: 1,
            title: "Late",
            is_overdue: true,
            is_complete: false,
          }),
        ],
      }),
      member({
        member_id: 3,
        full_name: "Behind",
        total: 2,
        completion_percent: 25,
        tasks: [],
      }),
    ];

    expect(
      sortActiveMembers(members, "incomplete_first").map((row) => row.full_name),
    ).toEqual(["Overdue", "Behind", "Complete"]);
  });

  it("sorts active members alphabetically and by completion percent", () => {
    const members = [
      member({
        member_id: 1,
        full_name: "Zoe",
        total: 2,
        completion_percent: 80,
        tasks: [],
      }),
      member({
        member_id: 2,
        full_name: "Amy",
        total: 2,
        completion_percent: 20,
        tasks: [],
      }),
    ];

    expect(
      sortActiveMembers(members, "alphabetical").map((row) => row.full_name),
    ).toEqual(["Amy", "Zoe"]);
    expect(
      sortActiveMembers(members, "completion_desc").map((row) => row.full_name),
    ).toEqual(["Zoe", "Amy"]);
  });

  it("filters overview members by assignee category", () => {
    const members: TaskOverviewMember[] = [
      member({
        member_id: 1,
        full_name: "Board User",
        role: "board",
        total: 1,
        tasks: [task({ id: 1, title: "Book venue" })],
      }),
      member({
        member_id: 2,
        full_name: "apsana",
        role: "general",
        total: 2,
        tasks: [
          task({
            id: 2,
            title: "Help with tihar",
            assignee_has_volunteer_signup: true,
          }),
          task({
            id: 3,
            title: "Other task",
            assignee_has_volunteer_signup: false,
          }),
        ],
      }),
    ];

    expect(
      filterOverviewMembersByAssigneeCategory(members, "board").map(
        (row) => row.full_name,
      ),
    ).toEqual(["Board User"]);
    expect(
      filterOverviewMembersByAssigneeCategory(members, "general").map(
        (row) => row.full_name,
      ),
    ).toEqual(["apsana"]);
    expect(
      filterOverviewMembersByAssigneeCategory(members, "volunteers"),
    ).toEqual([
      expect.objectContaining({
        full_name: "apsana",
        total: 1,
        tasks: [expect.objectContaining({ title: "Help with tihar" })],
      }),
    ]);
    expect(filterOverviewMembersByAssigneeCategory(members, "all")).toEqual(
      members,
    );
  });
});

describe("task-oversight health & workload thresholds", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("classifies COMPLETED only when all tasks are done and total ≥ 1", () => {
    expect(
      classifyOversightHealthStatus(
        member({
          member_id: 1,
          full_name: "Done",
          total: 2,
          completed: 2,
          tasks: [
            task({ id: 1, title: "A", status: "done", is_complete: true }),
            task({ id: 2, title: "B", status: "done", is_complete: true }),
          ],
        }),
        now,
      ),
    ).toBe("completed");

    expect(
      classifyOversightHealthStatus(
        member({ member_id: 2, full_name: "Empty", total: 0, tasks: [] }),
        now,
      ),
    ).toBe("no_data");
  });

  it("classifies OVERDUE when any open task is overdue", () => {
    expect(
      classifyOversightHealthStatus(
        member({
          member_id: 1,
          full_name: "Late",
          total: 2,
          completed: 1,
          tasks: [
            task({ id: 1, title: "Done", status: "done", is_complete: true }),
            task({
              id: 2,
              title: "Late",
              is_overdue: true,
              is_complete: false,
            }),
          ],
        }),
        now,
      ),
    ).toBe("overdue");
  });

  it("classifies AT RISK for due-within-48h without overdue", () => {
    expect(
      isDueWithinNext48Hours(
        task({
          id: 1,
          title: "Soon",
          due_date: "2026-07-16T10:00:00.000Z",
        }),
        now,
      ),
    ).toBe(true);

    expect(
      classifyOversightHealthStatus(
        member({
          member_id: 1,
          full_name: "Soon",
          total: 2,
          completed: 1,
          completion_percent: 50,
          tasks: [
            task({ id: 1, title: "Done", status: "done", is_complete: true }),
            task({
              id: 2,
              title: "Due soon",
              due_date: "2026-07-16T10:00:00.000Z",
            }),
          ],
        }),
        now,
      ),
    ).toBe("at_risk");
  });

  it("classifies AT RISK for completion below 50% with open work and no overdue", () => {
    expect(
      classifyOversightHealthStatus(
        member({
          member_id: 1,
          full_name: "Behind",
          total: 4,
          completed: 1,
          tasks: [
            task({ id: 1, title: "Done", status: "done", is_complete: true }),
            task({ id: 2, title: "Open A" }),
            task({ id: 3, title: "Open B" }),
            task({ id: 4, title: "Open C" }),
          ],
        }),
        now,
      ),
    ).toBe("at_risk");
  });

  it("classifies ON TRACK with no overdue, no due-soon, and completion ≥ 50%", () => {
    expect(
      classifyOversightHealthStatus(
        member({
          member_id: 1,
          full_name: "Steady",
          total: 2,
          completed: 1,
          tasks: [
            task({ id: 1, title: "Done", status: "done", is_complete: true }),
            task({
              id: 2,
              title: "Later",
              due_date: "2026-08-01T12:00:00.000Z",
            }),
          ],
        }),
        now,
      ),
    ).toBe("on_track");
  });

  it("applies exact workload bands and overloaded override", () => {
    expect(classifyOversightWorkload(0, 0)).toBe("low");
    expect(classifyOversightWorkload(2, 0)).toBe("low");
    expect(classifyOversightWorkload(3, 0)).toBe("medium");
    expect(classifyOversightWorkload(5, 0)).toBe("medium");
    expect(classifyOversightWorkload(6, 0)).toBe("high");
    expect(classifyOversightWorkload(9, 0)).toBe("high");
    expect(classifyOversightWorkload(10, 0)).toBe("overloaded");
    expect(classifyOversightWorkload(2, 3)).toBe("overloaded");
  });

  it("sorts snapshots Overdue → At Risk → On Track → Completed by default", () => {
    const snapshots = [
      buildOversightMemberSnapshot(
        member({
          member_id: 1,
          full_name: "Complete",
          total: 1,
          tasks: [
            task({ id: 1, title: "Done", status: "done", is_complete: true }),
          ],
        }),
        now,
      ),
      buildOversightMemberSnapshot(
        member({
          member_id: 2,
          full_name: "Late",
          total: 1,
          tasks: [
            task({
              id: 2,
              title: "Late",
              is_overdue: true,
              is_complete: false,
            }),
          ],
        }),
        now,
      ),
      buildOversightMemberSnapshot(
        member({
          member_id: 3,
          full_name: "Steady",
          total: 2,
          tasks: [
            task({ id: 3, title: "Done", status: "done", is_complete: true }),
            task({
              id: 4,
              title: "Later",
              due_date: "2026-08-01T12:00:00.000Z",
            }),
          ],
        }),
        now,
      ),
      buildOversightMemberSnapshot(
        member({
          member_id: 4,
          full_name: "Risk",
          total: 3,
          tasks: [
            task({ id: 5, title: "Open A" }),
            task({ id: 6, title: "Open B" }),
            task({ id: 7, title: "Open C" }),
          ],
        }),
        now,
      ),
    ];

    expect(
      sortOversightSnapshots(snapshots, "status").map(
        (row) => row.member.full_name,
      ),
    ).toEqual(["Late", "Risk", "Steady", "Complete"]);
  });

  it("lists events with overdue risk first", () => {
    const events = listOversightEvents([
      task({
        id: 1,
        title: "Done",
        event_id: 10,
        event_name: "Dashain",
        status: "done",
        is_complete: true,
      }),
      task({
        id: 2,
        title: "Open",
        event_id: 10,
        event_name: "Dashain",
        status: "todo",
      }),
      task({
        id: 3,
        title: "Late",
        event_id: 22,
        event_name: "Tihar",
        status: "todo",
        is_overdue: true,
      }),
    ]);

    expect(events.map((event) => event.eventId)).toEqual([22, 10]);
    expect(events[0]).toMatchObject({
      eventName: "Tihar",
      overdueTasks: 1,
      openTasks: 1,
    });
  });

  it("filters overview members to a single event", () => {
    const members = [
      member({
        member_id: 1,
        full_name: "Alex",
        total: 2,
        tasks: [
          task({ id: 1, title: "A", event_id: 10, event_name: "Dashain" }),
          task({ id: 2, title: "B", event_id: 22, event_name: "Tihar" }),
        ],
      }),
      member({
        member_id: 2,
        full_name: "Blair",
        total: 1,
        tasks: [
          task({ id: 3, title: "C", event_id: 22, event_name: "Tihar" }),
        ],
      }),
    ];

    const scoped = filterOverviewMembersByEvent(members, 22);
    expect(scoped).toHaveLength(2);
    expect(scoped[0].tasks.map((row) => row.id)).toEqual([2]);
    expect(scoped[0].total).toBe(1);
    expect(scoped[1].tasks.map((row) => row.id)).toEqual([3]);
  });
});
