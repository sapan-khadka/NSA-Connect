import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../design-system/cx";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
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

/**
 * CampusOS base badge / status chip. Soft pastel surfaces matching the token palette.
 */
export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
