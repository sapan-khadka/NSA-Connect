import { Check } from "lucide-react";

import type { KanbanColumnId } from "../../lib/kanban-status";
import { getKanbanColumnTheme } from "../../lib/kanban-theme";

type KanbanProgressRingProps = {
  percent: number;
  columnId: KanbanColumnId;
  size?: number;
};

function KanbanDoneCheckmark({
  size = 44,
  color,
}: {
  size?: number;
  color: string;
}) {
  const iconSize = Math.round(size * 0.42);

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      aria-hidden="true"
    >
      <Check
        size={iconSize}
        strokeWidth={2.5}
        className="text-white"
        aria-hidden="true"
      />
    </div>
  );
}

export function KanbanProgressRing({
  percent,
  columnId,
  size = 44,
}: KanbanProgressRingProps) {
  const theme = getKanbanColumnTheme(columnId);
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={theme.progressColor}
        strokeOpacity={0.18}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={theme.progressColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

type KanbanProgressRingWithLabelProps = {
  percent: number;
  columnId: KanbanColumnId;
};

export function KanbanProgressRingWithLabel({
  percent,
  columnId,
}: KanbanProgressRingWithLabelProps) {
  const theme = getKanbanColumnTheme(columnId);

  if (columnId === "done") {
    return <KanbanDoneCheckmark color={theme.progressColor} />;
  }

  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      <KanbanProgressRing percent={percent} columnId={columnId} />
      <span
        className="absolute text-[10px] font-medium"
        style={{ color: theme.progressColor }}
      >
        {percent}%
      </span>
    </div>
  );
}

export function getTaskProgressPercent(task: {
  task_kind?: "simple" | "checklist";
  status?: "todo" | "in_progress" | "done";
  checklist_items: { is_completed: boolean }[];
}): number {
  if (task.task_kind === "simple") {
    if (task.status === "done") {
      return 100;
    }
    if (task.status === "in_progress") {
      return 50;
    }
    return 0;
  }

  const total = task.checklist_items.length;
  if (total === 0) {
    return 0;
  }
  const completed = task.checklist_items.filter((item) => item.is_completed).length;
  return Math.round((completed / total) * 100);
}
