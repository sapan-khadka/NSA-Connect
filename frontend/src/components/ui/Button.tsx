import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../../design-system/cx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary/30",
  secondary:
    "bg-badge-teal-bg text-primary hover:bg-badge-teal-bg/80 focus-visible:ring-primary/20",
  outline:
    "border border-gray-200 bg-white text-foreground hover:border-primary/40 hover:bg-badge-teal-bg focus-visible:ring-primary/20",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-muted focus-visible:ring-primary/20",
  danger:
    "bg-overdue text-white hover:bg-overdue/90 focus-visible:ring-overdue/30",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-2.5 text-base",
};

/**
 * CampusOS base button. Visual styles match existing primary/outline patterns.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
