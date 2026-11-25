import type { ReactNode } from "react";

import { cx } from "../../design-system/cx";

type DetailsEmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Centered premium empty state for unselected / no-data panels. */
export function DetailsEmptyState({
  title,
  description,
  className,
  actionLabel,
  onAction,
}: DetailsEmptyStateProps) {
  return (
    <div className={cx("details-panel-empty", className)} role="status">
      <p className="details-panel-empty-title">{title}</p>
      {description != null ? (
        <p className="details-panel-empty-copy">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          className="details-panel-empty-action mt-3 text-sm font-medium text-accent underline-offset-2 hover:underline"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
