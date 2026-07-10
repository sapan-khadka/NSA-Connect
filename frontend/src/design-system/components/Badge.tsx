import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../cx";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type BadgeSize = "sm" | "md";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
};

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-label",
  primary: "bg-badge-teal-bg text-badge-teal",
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  danger: "bg-overdue-surface text-overdue",
  info: "bg-badge-blue-bg text-badge-blue",
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-0.5 text-xs",
};

/**
 * Status / category pill using semantic badge tokens.
 */
export function Badge({
  variant = "neutral",
  size = "md",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
