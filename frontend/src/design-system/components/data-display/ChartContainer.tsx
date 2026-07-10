import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Card } from "../Card";
import { Skeleton } from "../Skeleton";
import { DataStatus } from "./DataStatus";
import { EmptyState } from "./EmptyState";

export type ChartContainerProps = {
  title?: ReactNode;
  description?: ReactNode;
  /** Chart library output (SVG, canvas wrapper, etc.). */
  children?: ReactNode;
  headerActions?: ReactNode;
  loading?: boolean;
  error?: ReactNode | null;
  empty?: boolean;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  /** Fixed chart area height. */
  heightClassName?: string;
  className?: string;
};

/**
 * Chart shell with title and loading / empty / error states.
 * Does not depend on a specific charting library.
 */
export function ChartContainer({
  title,
  description,
  children,
  headerActions,
  loading = false,
  error = null,
  empty = false,
  emptyTitle = "No chart data",
  emptyDescription = "There is not enough data to display a chart.",
  heightClassName = "h-64",
  className = "",
}: ChartContainerProps) {
  return (
    <Card className={cx("flex flex-col", className)} padding="md">
      {(title || headerActions) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm text-label">{description}</p>
            ) : null}
          </div>
          {headerActions}
        </div>
      )}

      <div className={cx("mt-4", heightClassName)}>
        <DataStatus
          loading={loading}
          error={error}
          empty={empty}
          minHeightClassName="h-full min-h-0"
          loadingFallback={
            <div className="flex h-full flex-col justify-end gap-2 p-2" aria-hidden="true">
              <Skeleton height="40%" />
              <Skeleton height="55%" />
              <Skeleton height="30%" />
              <Skeleton height="70%" />
            </div>
          }
          emptyFallback={
            <EmptyState title={emptyTitle} description={emptyDescription} />
          }
          className="h-full"
        >
          <div className="h-full w-full">{children}</div>
        </DataStatus>
      </div>
    </Card>
  );
}
