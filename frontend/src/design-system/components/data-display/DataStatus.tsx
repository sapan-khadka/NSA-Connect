import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Skeleton } from "../Skeleton";
import { Spinner } from "../Spinner";

export type DataStatusProps = {
  loading?: boolean;
  error?: ReactNode | null;
  empty?: boolean;
  /** Rendered when `empty` is true and not loading/error. */
  emptyFallback?: ReactNode;
  children: ReactNode;
  /** Loading UI override. */
  loadingFallback?: ReactNode;
  className?: string;
  /** Min height while loading / empty. */
  minHeightClassName?: string;
};

/**
 * Shared loading / error / empty gate for data views.
 */
export function DataStatus({
  loading = false,
  error = null,
  empty = false,
  emptyFallback,
  loadingFallback,
  children,
  className = "",
  minHeightClassName = "min-h-40",
}: DataStatusProps) {
  if (loading) {
    return (
      <div
        className={cx(
          "flex items-center justify-center",
          minHeightClassName,
          className,
        )}
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        {loadingFallback ?? <Spinner size="lg" label="Loading" />}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cx(
          "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center",
          minHeightClassName,
          className,
        )}
        role="alert"
      >
        {typeof error === "string" ? (
          <p className="text-sm text-overdue">{error}</p>
        ) : (
          error
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className={cx(minHeightClassName, className)}>
        {emptyFallback}
      </div>
    );
  }

  return <>{children}</>;
}

/** Simple skeleton stack for table / list loading. */
export function DataTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden="true">
      <Skeleton height={16} width="40%" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={36} />
      ))}
    </div>
  );
}
