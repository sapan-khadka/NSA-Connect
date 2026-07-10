import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Button } from "../Button";

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actionLabel?: ReactNode;
  onAction?: () => void;
  action?: ReactNode;
  className?: string;
};

/**
 * Generic empty placeholder. Prefer `action` for custom CTAs, or `actionLabel` + `onAction`.
 */
export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      data-testid="ds-empty-state"
      className={cx(
        "flex flex-col items-center px-4 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-badge-teal-bg text-primary"
        >
          {icon}
        </div>
      ) : null}
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-sm text-label">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-4">{action}</div>
      ) : actionLabel && onAction ? (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
