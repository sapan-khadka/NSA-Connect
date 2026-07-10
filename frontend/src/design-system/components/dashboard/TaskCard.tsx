import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";
import { Card } from "../Card";

export type TaskCardProps = {
  title: ReactNode;
  status?: ReactNode;
  dueLabel?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  /** Highlight overdue / blocked. */
  tone?: "default" | "success" | "warning" | "danger";
  actions?: ReactNode;
  className?: string;
};

const TONE_BORDER: Record<NonNullable<TaskCardProps["tone"]>, string> = {
  default: "border-gray-200",
  success: "border-success/25 bg-success-surface/50",
  warning: "border-warning/25 bg-warning-surface",
  danger: "border-overdue/20 bg-overdue-surface",
};

/**
 * Task summary card for work queues and dashboards.
 */
export function TaskCard({
  title,
  status,
  dueLabel,
  meta,
  icon,
  to,
  href,
  onClick,
  tone = "default",
  actions,
  className = "",
}: TaskCardProps) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {meta ? <p className="mt-1 text-sm text-label">{meta}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {status}
            {dueLabel ? (
              <span className="text-sm text-label">{dueLabel}</span>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </>
  );

  const shellClass = cx(
    "block rounded-card border p-4 transition duration-200",
    TONE_BORDER[tone],
    to || href || onClick
      ? "hover:-translate-y-0.5 hover:shadow-card"
      : "bg-surface-card shadow-card",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={shellClass} onClick={onClick}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={shellClass} onClick={onClick}>
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        className={cx(shellClass, "w-full text-left")}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }

  return (
    <Card padding="none" className={cx(shellClass, "shadow-card")}>
      <div className="p-4">{body}</div>
    </Card>
  );
}
