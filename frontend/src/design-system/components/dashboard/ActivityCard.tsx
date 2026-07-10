import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";

export type ActivityCardProps = {
  title: ReactNode;
  message: ReactNode;
  icon?: ReactNode;
  actionLabel?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  footnote?: ReactNode;
  /** Emphasize message (urgent). */
  tone?: "default" | "urgent";
  /** Show connector line below (timeline). */
  showConnector?: boolean;
  className?: string;
};

/**
 * Single activity / timeline row for feeds and dashboards.
 */
export function ActivityCard({
  title,
  message,
  icon,
  actionLabel,
  to,
  href,
  onClick,
  footnote,
  tone = "default",
  showConnector = false,
  className = "",
}: ActivityCardProps) {
  const action =
    actionLabel && (to || href || onClick) ? (
      to ? (
        <Link
          to={to}
          onClick={onClick}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          {actionLabel}
        </Link>
      ) : href ? (
        <a
          href={href}
          onClick={onClick}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          {actionLabel}
        </a>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          {actionLabel}
        </button>
      )
    ) : null;

  return (
    <div className={cx("relative list-none", className)}>
      <div className="flex gap-4">
        {icon ? (
          <div className="relative flex w-8 shrink-0 flex-col items-center">
            {icon}
            {showConnector ? (
              <span
                aria-hidden="true"
                className="mt-2 w-px flex-1 bg-gray-200"
              />
            ) : null}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 pb-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {action}
          </div>
          <p
            className={cx(
              "mt-1 text-sm",
              tone === "urgent"
                ? "font-medium text-foreground"
                : "text-label",
            )}
          >
            {message}
          </p>
          {footnote ? (
            <p className="mt-1 text-sm text-label">{footnote}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
