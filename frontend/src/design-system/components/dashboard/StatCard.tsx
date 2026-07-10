import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";

export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  /** Emphasize description (e.g. overdue). */
  descriptionTone?: "default" | "danger";
  loading?: boolean;
  className?: string;
};

/**
 * Metric tile: icon, label, large value, optional description / link.
 */
export function StatCard({
  label,
  value,
  description,
  icon,
  to,
  href,
  onClick,
  descriptionTone = "default",
  loading = false,
  className = "",
}: StatCardProps) {
  const content = (
    <>
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <p className="mt-4 text-sm font-semibold text-label">{label}</p>
      <p className="mt-2 text-[32px] font-bold leading-none tracking-tight text-foreground">
        {loading ? "—" : value}
      </p>
      {description ? (
        <p
          className={cx(
            "mt-2 line-clamp-2 text-sm",
            descriptionTone === "danger"
              ? "font-medium text-overdue"
              : "text-label",
          )}
        >
          {description}
        </p>
      ) : null}
    </>
  );

  const shellClass = cx(
    "group flex h-full flex-col rounded-card border border-gray-200 bg-surface-card p-4 shadow-card transition duration-200 ease-out",
    to || href || onClick
      ? "hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-card-hover"
      : "",
    className,
  );

  if (to) {
    return (
      <Link to={to} className={shellClass} onClick={onClick}>
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={shellClass} onClick={onClick}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cx(shellClass, "w-full text-left")} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={shellClass}>{content}</div>;
}
