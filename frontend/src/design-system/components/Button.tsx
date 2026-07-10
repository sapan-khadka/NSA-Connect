import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../cx";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the control. */
  loading?: boolean;
  children: ReactNode;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary/30",
  secondary:
    "bg-badge-teal-bg text-primary hover:bg-badge-teal-bg/80 focus-visible:ring-primary/20",
  outline:
    "border border-gray-200 bg-surface-card text-foreground hover:border-primary/40 hover:bg-badge-teal-bg focus-visible:ring-primary/20",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-muted focus-visible:ring-primary/20",
  danger:
    "bg-overdue text-white hover:bg-overdue/90 focus-visible:ring-overdue/30",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "min-h-9 gap-1.5 px-3 py-1.5 text-sm",
  md: "min-h-11 gap-2 px-4 py-2 text-sm",
  lg: "min-h-12 gap-2 px-5 py-2.5 text-base",
};

const SPINNER_SIZE: Record<ButtonSize, "sm" | "md"> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

/**
 * CampusOS button. Token-backed variants with loading and disabled states.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-full font-medium transition duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner
          size={SPINNER_SIZE[size]}
          label="Loading"
          className="shrink-0"
        />
      ) : null}
      <span className={loading ? "opacity-90" : undefined}>{children}</span>
    </button>
  );
}
