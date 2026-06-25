import type { PrepTaskResponse } from "../lib/events-api";
import { formatEventDateTime } from "../lib/format-datetime";
import { calcTaskProgress } from "../lib/prep-progress";
import { PrepProgressBar } from "./PrepProgressBar";

type PrepTaskChecklistProps = {
  task: PrepTaskResponse;
  canToggle: boolean;
  togglingItemId?: number | null;
  onToggleItem: (taskId: number, itemId: number, isCompleted: boolean) => void;
};

export function PrepTaskChecklist({
  task,
  canToggle,
  togglingItemId = null,
  onToggleItem,
}: PrepTaskChecklistProps) {
  const sortedItems = [...task.checklist_items].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const taskProgress = calcTaskProgress(task);

  return (
    <article className="rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-medium text-primary">{task.group_name}</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          {task.is_complete ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
              Complete
            </span>
          ) : null}
          {task.is_overdue ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">
              Overdue
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Due {formatEventDateTime(task.due_date)}
        {task.assignee_id ? ` · Assignee #${task.assignee_id}` : ""}
      </p>

      {sortedItems.length > 0 ? (
        <div className="mt-3">
          <PrepProgressBar progress={taskProgress} label="Task progress" />
        </div>
      ) : null}

      {sortedItems.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No checklist items yet.</p>
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
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-gray-300 bg-white text-transparent",
                    canToggle && !isPending
                      ? "cursor-pointer hover:border-emerald-400"
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
                      ? "text-gray-500 line-through"
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
