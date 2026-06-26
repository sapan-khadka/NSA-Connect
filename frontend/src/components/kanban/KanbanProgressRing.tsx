type KanbanProgressRingProps = {
  percent: number;
  tone?: "default" | "danger" | "success";
  size?: number;
};

const TONE_STROKE = {
  default: "#e94560",
  danger: "#dc2626",
  success: "#059669",
} as const;

export function KanbanProgressRing({
  percent,
  tone = "default",
  size = 44,
}: KanbanProgressRingProps) {
  const stroke = 4;
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
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-gray-200"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

export function KanbanProgressRingWithLabel({
  percent,
  tone = "default",
}: Omit<KanbanProgressRingProps, "size">) {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center">
      <KanbanProgressRing percent={percent} tone={tone} />
      <span className="absolute text-[10px] font-bold text-primary">{percent}%</span>
    </div>
  );
}

export function getKanbanProgressTone(
  isOverdue: boolean,
  isComplete: boolean,
): "default" | "danger" | "success" {
  if (isComplete) {
    return "success";
  }
  if (isOverdue) {
    return "danger";
  }
  return "default";
}

export function getTaskProgressPercent(task: {
  checklist_items: { is_completed: boolean }[];
}): number {
  const total = task.checklist_items.length;
  if (total === 0) {
    return 0;
  }
  const completed = task.checklist_items.filter((item) => item.is_completed).length;
  return Math.round((completed / total) * 100);
}
