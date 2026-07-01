import type { PrepProgress } from "../lib/prep-progress";

type PrepProgressBarProps = {
  progress: PrepProgress;
  label?: string;
  variant?: "default" | "danger";
};

export function PrepProgressBar({
  progress,
  label = "Prep progress",
  variant = "default",
}: PrepProgressBarProps) {
  const fillClass =
    variant === "danger" ? "bg-overdue" : "bg-accent";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-label">
          {progress.completed}/{progress.total} ({progress.percent}%)
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${fillClass}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
