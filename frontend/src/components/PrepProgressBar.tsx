import type { PrepProgress } from "../lib/prep-progress";

type PrepProgressBarProps = {
  progress: PrepProgress;
  label?: string;
};

export function PrepProgressBar({
  progress,
  label = "Prep progress",
}: PrepProgressBarProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-primary">{label}</span>
        <span className="text-gray-600">
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
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
