import type { MemberResponse } from "../lib/auth-api";
import type { EventTaskResponse } from "../lib/event-tasks-api";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  calcChecklistTaskProgress,
  isOverdueIncompleteChecklistTask,
} from "../lib/task-progress";
import { PrepProgressBar } from "./PrepProgressBar";
import { PrepTaskAssigneeSelect } from "./PrepTaskAssigneeSelect";

type ChecklistTaskCardProps = {
  task: EventTaskResponse;
  canToggle: boolean;
  canAssign: boolean;
  assignableMembers: MemberResponse[];
  togglingItemId?: number | null;
  assigningTaskId?: number | null;
  onToggleItem: (taskId: number, itemId: number, isCompleted: boolean) => void;
  onAssign: (taskId: number, assigneeId: number | null) => void;
};

function getAssigneeLabel(
  assigneeId: number | null,
  assignableMembers: MemberResponse[],
  assigneeName: string | null,
): string | null {
  if (assigneeName) {
    return assigneeName;
  }
  if (assigneeId === null) {
    return null;
  }
  return assignableMembers.find((member) => member.id === assigneeId)?.full_name ?? null;
}

export function ChecklistTaskCard({
  task,
  canToggle,
  canAssign,
  assignableMembers,
  togglingItemId = null,
  assigningTaskId = null,
  onToggleItem,
  onAssign,
}: ChecklistTaskCardProps) {
  const sortedItems = [...task.checklist_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const taskProgress = calcChecklistTaskProgress(task);
  const assigneeLabel = getAssigneeLabel(
    task.assignee_id,
    assignableMembers,
    task.assignee_name,
  );
  const showOverdue = isOverdueIncompleteChecklistTask(task);
  const title = task.group_name ?? task.title;

  return (
    <article
      className={[
        "rounded-md border p-3",
        showOverdue ? "border-primary/20 bg-surface-muted" : "border-gray-200",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-medium text-foreground">{title}</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          {task.is_complete ? (
            <span className="rounded-full bg-mint px-2 py-0.5 text-primary">
              Complete
            </span>
          ) : null}
          {showOverdue ? (
            <span className="ds-tag-overdue">Overdue</span>
          ) : null}
        </div>
      </div>

      {task.due_date ? (
        <p
          className={[
            "mt-1 text-xs",
            showOverdue ? "text-overdue" : "text-label",
          ].join(" ")}
        >
          Due {formatEventDateTime(task.due_date)}
          {!canAssign && assigneeLabel ? ` · ${assigneeLabel}` : null}
        </p>
      ) : null}

      {canAssign ? (
        <PrepTaskAssigneeSelect
          assigneeId={task.assignee_id}
          assignableMembers={assignableMembers}
          disabled={assigningTaskId === task.id}
          onAssign={(assigneeId) => onAssign(task.id, assigneeId)}
        />
      ) : null}

      {sortedItems.length > 0 ? (
        <div className="mt-3">
          <PrepProgressBar
            progress={taskProgress}
            label="Task progress"
            variant={showOverdue ? "danger" : "default"}
          />
        </div>
      ) : null}

      {sortedItems.length === 0 ? (
        <p className="mt-3 text-sm text-label">No checklist items yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sortedItems.map((item) => {
            const isPending = togglingItemId === item.id;

            return (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <button
                  type="button"
                  aria-label={`${item.is_completed ? "Uncheck" : "Check"} ${item.label}`}
                  aria-pressed={item.is_completed}
                  disabled={!canToggle || isPending}
                  onClick={() =>
                    onToggleItem(task.id, item.id, !item.is_completed)
                  }
                  className={[
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors",
                    item.is_completed
                      ? "border-accent bg-accent text-white"
                      : "border-gray-300 bg-white text-transparent",
                    canToggle && !isPending
                      ? "cursor-pointer hover:border-accent/70"
                      : "cursor-default",
                    isPending ? "opacity-60" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  ✓
                </button>
                <span
                  className={
                    item.is_completed
                      ? "text-label line-through"
                      : "text-primary"
                  }
                >
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
