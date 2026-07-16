import type { ReactNode } from "react";

import { cx } from "../../design-system/cx";

type DetailsEmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

/** Centered premium empty state for unselected / no-data panels. */
export function DetailsEmptyState({
  title,
  description,
  className,
}: DetailsEmptyStateProps) {
  return (
    <div className={cx("details-panel-empty", className)} role="status">
      <p className="details-panel-empty-title">{title}</p>
      {description != null ? (
        <p className="details-panel-empty-copy">{description}</p>
      ) : null}
    </div>
  );
}
