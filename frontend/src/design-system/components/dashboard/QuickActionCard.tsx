import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cx } from "../../cx";

export type QuickActionCardProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/**
 * Compact tool / shortcut tile for dashboards and role tool grids.
 */
export function QuickActionCard({
  title,
  description,
  icon,
  to,
  href,
  onClick,
  className = "",
}: QuickActionCardProps) {
  const body = (
    <>
      {icon ? <div className="shrink-0">{icon}</div> : null}
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-label">
          {description}
        </p>
      ) : null}
    </>
  );

  const shellClass = cx(
    "group flex h-full min-h-[7.5rem] flex-col rounded-card border border-gray-200 bg-surface-muted/60 p-4 transition duration-200 ease-out",
    "hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-card hover:shadow-card-hover",
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

  return <div className={shellClass}>{body}</div>;
}
