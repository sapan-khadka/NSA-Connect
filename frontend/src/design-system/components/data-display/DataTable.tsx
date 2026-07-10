import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Card } from "../Card";
import { DataStatus, DataTableSkeleton } from "./DataStatus";
import { EmptyState } from "./EmptyState";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Stable row key. */
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: ReactNode | null;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyIcon?: ReactNode;
  caption?: ReactNode;
  className?: string;
  /** Called when a row is activated (optional). */
  onRowClick?: (row: T) => void;
};

const ALIGN: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Token-styled data table with loading, empty, and error states.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  error = null,
  emptyTitle = "No results",
  emptyDescription = "There is nothing to show yet.",
  emptyIcon,
  caption,
  className = "",
  onRowClick,
}: DataTableProps<T>) {
  return (
    <Card padding="none" className={cx("overflow-hidden", className)}>
      <DataStatus
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        loadingFallback={<DataTableSkeleton />}
        emptyFallback={
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            {caption ? (
              <caption className="sr-only">{caption}</caption>
            ) : null}
            <thead className="bg-surface-muted">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cx(
                      "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-label",
                      ALIGN[column.align ?? "left"],
                      column.headerClassName,
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-surface-card">
              {rows.map((row) => (
                <tr
                  key={getRowId(row)}
                  className={cx(
                    "transition-colors",
                    onRowClick
                      ? "cursor-pointer hover:bg-surface-muted"
                      : "",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cx(
                        "px-4 py-3 text-foreground",
                        ALIGN[column.align ?? "left"],
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataStatus>
    </Card>
  );
}
