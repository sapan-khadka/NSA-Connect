import type { HTMLAttributes } from "react";

import { cx } from "../cx";

export type SpinnerSize = "sm" | "md" | "lg";

export type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  size?: SpinnerSize;
  /** Accessible label announced to screen readers. */
  label?: string;
};

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-[3px]",
};

/**
 * Indeterminate loading spinner. Uses primary token color.
 */
export function Spinner({
  size = "md",
  label = "Loading",
  className = "",
  ...rest
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cx("inline-flex items-center justify-center", className)}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cx(
          "animate-spin rounded-full border-primary/25 border-t-primary",
          SIZE_CLASS[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
