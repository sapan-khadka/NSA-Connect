import {
  computeEventReadiness,
  type EventReadinessInput,
  type ReadinessCheck,
} from "./event-readiness";
import type { EventDetailResponse } from "./events-api";
import type { EventTaskResponse } from "./event-tasks-api";

export type EventManageTab =
  | "overview"
  | "attendees"
  | "operations"
  | "record";

export type AttentionAction =
  | "volunteers"
  | "budget"
  | "schedule"
  | "cover"
  | "details"
  | "tasks";

export type AttentionItem = {
  id: string;
  severity: "warn" | "fail" | "open";
  label: string;
  actionLabel: string;
  action: AttentionAction;
};

const TAB_ALIASES: Record<string, EventManageTab | "edit"> = {
  overview: "overview",
  attendees: "attendees",
  people: "attendees",
  operations: "operations",
  ops: "operations",
  record: "record",
  details: "edit",
};

export function parseManageTab(value: string | null): EventManageTab {
  if (!value) {
    return "overview";
  }
  const mapped = TAB_ALIASES[value];
  if (!mapped || mapped === "edit") {
    return "overview";
  }
  return mapped;
}

export function shouldOpenEventEditor(
  tabParam: string | null,
  editParam: string | null,
): boolean {
  return (
    tabParam === "details" || editParam === "1" || editParam === "true"
  );
}

const ACTION_LABEL: Record<ReadinessCheck["resolveTarget"], string> = {
  volunteers: "Add roles",
  budget: "Set budget",
  schedule: "Edit",
  cover: "Add cover",
  details: "Edit",
};

/** Readiness checks that are actual work, not optional polish. */
const ACTIONABLE_CHECK_IDS = new Set<ReadinessCheck["id"]>([
  "schedule",
  "location",
  "budget",
  "volunteers",
]);

function severityFor(status: ReadinessCheck["status"]): "warn" | "fail" | null {
  if (status === "fail") {
    return "fail";
  }
  if (status === "warn") {
    return "warn";
  }
  return null;
}

export function buildNeedsAttentionItems(input: {
  event: EventDetailResponse;
  readinessInput: EventReadinessInput;
  openTasks: EventTaskResponse[];
}): AttentionItem[] {
  const readiness = computeEventReadiness(input.readinessInput);
  const items: AttentionItem[] = [];
  const seen = new Set<string>();

  for (const check of readiness.checks) {
    if (!ACTIONABLE_CHECK_IDS.has(check.id)) {
      continue;
    }
    const severity = severityFor(check.status);
    if (!severity) {
      continue;
    }
    const id = `readiness-${check.id}`;
    seen.add(check.resolveTarget);
    items.push({
      id,
      severity,
      label: check.label,
      actionLabel: ACTION_LABEL[check.resolveTarget],
      action: check.resolveTarget,
    });
  }

  if (!input.event.description?.trim() && !seen.has("details")) {
    items.push({
      id: "description",
      severity: "warn",
      label: "Event description is missing",
      actionLabel: "Edit",
      action: "details",
    });
  }

  const overdue = input.openTasks.filter((task) => task.is_overdue);
  if (overdue.length > 0) {
    for (const task of overdue.slice(0, 2)) {
      items.push({
        id: `task-${task.id}`,
        severity: "fail",
        label: task.title,
        actionLabel: "View task",
        action: "tasks",
      });
    }
  } else if (input.openTasks.length > 0) {
    const count = input.openTasks.length;
    items.push({
      id: "open-tasks",
      severity: "open",
      label:
        count === 1 ? "1 task is still open" : `${count} tasks are still open`,
      actionLabel: count === 1 ? "View task" : "View tasks",
      action: "tasks",
    });
  }

  return items;
}

export function formatEventCommandWhen(
  isoDate: string,
  location?: string | null,
): string {
  const start = new Date(isoDate);
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  }).format(start);
  const venue = location?.trim();
  return venue ? `${date} · ${time} · ${venue}` : `${date} · ${time}`;
}
