import type { ReactNode, ButtonHTMLAttributes } from "react";

import { cx } from "../../design-system/cx";

type DetailsActionsProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Footer action row. Pass primary/secondary controls as children
 * (typically Links or buttons styled with details-panel-btn classes).
 */
export function DetailsActions({ children, className }: DetailsActionsProps) {
  return (
    <div className={cx("details-panel-actions", className)}>{children}</div>
  );
}

type DetailsActionButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Visual helper for action chrome when not using a Link. */
export function detailsActionClass(
  variant: "primary" | "secondary" = "primary",
  className?: string,
): string {
  return cx(
    "details-panel-btn",
    variant === "primary"
      ? "details-panel-btn--primary"
      : "details-panel-btn--secondary",
    className,
  );
}

export function DetailsActionButton({
  children,
  variant = "primary",
  className,
  ...rest
}: DetailsActionButtonProps) {
  return (
    <button
      type="button"
      className={detailsActionClass(variant, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
