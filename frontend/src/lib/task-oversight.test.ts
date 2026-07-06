import { describe, expect, it } from "vitest";

import type { EventTaskResponse, TaskOverviewMember } from "./event-tasks-api";
import {
  countOverdueTasks,
  filterOverviewMembersByAssigneeCategory,
  sortActiveMembers,
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
  overrides: Partial<TaskOverviewMember> & Pick<TaskOverviewMember, "member_id" | "full_name">,
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
          {
            id: 1,
            event_id: 1,
            event_name: "Dashain",
            task_kind: "simple",
            title: "Late task",
            group_name: null,
            description: "",
            assignee_id: 1,
            assignee_name: "Alex",
            status: "todo",
            due_date: null,
            is_overdue: true,
            is_complete: false,
            checklist_items: [],
            completion_note: null,
            completion_photo_url: null,
            completed_at: null,
            created_by_id: 1,
            created_at: "2026-03-18T12:00:00Z",
          },
          {
            id: 2,
            event_id: 1,
            event_name: "Dashain",
            task_kind: "simple",
            title: "Done task",
            group_name: null,
            description: "",
            assignee_id: 1,
            assignee_name: "Alex",
            status: "done",
            due_date: null,
            is_overdue: true,
            is_complete: true,
            checklist_items: [],
            completion_note: null,
            completion_photo_url: null,
            completed_at: "2026-03-19T12:00:00Z",
            created_by_id: 1,
            created_at: "2026-03-18T12:00:00Z",
          },
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
          {
            id: 1,
            event_id: 1,
            event_name: "Dashain",
            task_kind: "simple",
            title: "Late",
            group_name: null,
            description: "",
            assignee_id: 2,
            assignee_name: "Overdue",
            status: "todo",
            due_date: null,
            is_overdue: true,
            is_complete: false,
            checklist_items: [],
            completion_note: null,
            completion_photo_url: null,
            completed_at: null,
            created_by_id: 1,
            created_at: "2026-03-18T12:00:00Z",
          },
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
