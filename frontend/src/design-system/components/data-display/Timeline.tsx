import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Card } from "../Card";
import { DataStatus } from "./DataStatus";
import { EmptyState } from "./EmptyState";

export type TimelineItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "urgent";
};

export type TimelineProps = {
  items: TimelineItem[];
  loading?: boolean;
  error?: ReactNode | null;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyIcon?: ReactNode;
  className?: string;
  /** Wrap in a Card surface. */
  bordered?: boolean;
};

/**
 * Vertical timeline / activity list with data states.
 */
export function Timeline({
  items,
  loading = false,
  error = null,
  emptyTitle = "No activity",
  emptyDescription = "Updates will show up here.",
  emptyIcon,
  className = "",
  bordered = false,
}: TimelineProps) {
  const body = (
    <DataStatus
      loading={loading}
      error={error}
      empty={!loading && !error && items.length === 0}
      emptyFallback={
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      }
      className={className}
    >
      <ul className="space-y-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.id} className="relative">
              <div className="flex gap-4">
                <div className="relative flex w-8 shrink-0 flex-col items-center">
                  {item.icon ?? (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary"
                    />
                  )}
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="mt-2 w-px flex-1 bg-gray-200"
                    />
                  ) : null}
                </div>
                <div className={cx("min-w-0 flex-1", isLast ? "pb-0" : "pb-4")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    {item.meta ? (
                      <span className="shrink-0 text-xs text-label">
                        {item.meta}
                      </span>
                    ) : null}
                  </div>
                  {item.description ? (
                    <p
                      className={cx(
                        "mt-1 text-sm",
                        item.tone === "urgent"
                          ? "font-medium text-foreground"
                          : "text-label",
                      )}
                    >
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </DataStatus>
  );

  if (bordered) {
    return (
      <Card padding="md" className={className}>
        {body}
      </Card>
    );
  }

  return body;
}
