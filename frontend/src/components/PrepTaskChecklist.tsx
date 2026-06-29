import type { MemberResponse } from "../lib/auth-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import type { PrepTaskResponse } from "../lib/events-api";
import { prepTaskToEventTask } from "../lib/task-adapters";
import { ChecklistTaskCard } from "./ChecklistTaskCard";

type PrepTaskChecklistProps = {
  task: PrepTaskResponse | EventTaskResponse;
  canToggle: boolean;
  canAssign: boolean;
  assignableMembers: MemberResponse[];
  togglingItemId?: number | null;
  assigningTaskId?: number | null;
  onToggleItem: (taskId: number, itemId: number, isCompleted: boolean) => void;
  onAssign: (taskId: number, assigneeId: number | null) => void;
  eventId?: number;
  eventName?: string;
};

export function PrepTaskChecklist({
  task,
  eventId = 0,
  eventName = "",
  ...props
}: PrepTaskChecklistProps) {
  const normalized =
    "task_kind" in task
      ? task
      : prepTaskToEventTask(task, { id: eventId, name: eventName });

  return <ChecklistTaskCard task={normalized} {...props} />;
}

export { ChecklistTaskCard };
