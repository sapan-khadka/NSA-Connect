import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { cx } from "../../cx";

export type SidebarItemProps = {
  label: string;
  /** Leading icon or badge node. */
  icon?: ReactNode;
  /** React Router path. Prefer over `href` inside the SPA. */
  to?: string;
  /** External or plain anchor when not using the router. */
  href?: string;
  /** Match path exactly (NavLink `end`). */
  end?: boolean;
  /** Force active styles when not using NavLink matching. */
  active?: boolean;
  disabled?: boolean;
  /** Optional trailing content (chevron, count). */
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
};

const itemBaseClass =
  "group relative ds-icon-label w-full gap-2.5 rounded-card px-2.5 py-2 text-sm font-medium text-foreground transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

const itemActiveClass =
  "bg-badge-teal-bg font-semibold text-primary shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary";

const itemIdleClass =
  "hover:translate-x-0.5 hover:bg-surface-muted hover:text-foreground";

/**
 * Single sidebar navigation row. Supports router links, anchors, or buttons.
 */
export function SidebarItem({
  label,
  icon,
  to,
  href,
  end,
  active = false,
  disabled = false,
  trailing,
  onClick,
  className = "",
  title,
}: SidebarItemProps) {
  const content = (
    <>
      {icon ? (
        <span className="shrink-0 text-label transition-colors duration-200 group-hover:text-primary group-aria-[current=page]:text-primary">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );

  if (disabled) {
    return (
      <li>
        <span
          className={cx(
            itemBaseClass,
            "cursor-not-allowed opacity-45",
            className,
          )}
          aria-disabled="true"
          title={title ?? `${label} (coming soon)`}
        >
          {content}
        </span>
      </li>
    );
  }

  if (to) {
    return (
      <li>
        <NavLink
          to={to}
          end={end}
          onClick={onClick}
          title={title}
          className={({ isActive }) =>
            cx(
              itemBaseClass,
              isActive || active ? itemActiveClass : itemIdleClass,
              className,
            )
          }
        >
          {content}
        </NavLink>
      </li>
    );
  }

  if (href) {
    return (
      <li>
        <a
          href={href}
          onClick={onClick}
          title={title}
          className={cx(
            itemBaseClass,
            active ? itemActiveClass : itemIdleClass,
            className,
          )}
        >
          {content}
        </a>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cx(
          itemBaseClass,
          active ? itemActiveClass : itemIdleClass,
          className,
        )}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </button>
    </li>
  );
}

/** Optional helper link styled like a sidebar sub-item. */
export function SidebarSubItem({
  label,
  to,
  onClick,
  className = "",
}: {
  label: string;
  to: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <li>
      <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
          cx(
            "block rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-out",
            isActive
              ? "bg-primary/10 font-semibold text-primary"
              : "text-label hover:translate-x-0.5 hover:bg-surface-muted hover:text-foreground",
            className,
          )
        }
      >
        {label}
      </NavLink>
    </li>
  );
}

/** Section heading for grouped sidebar navigation. */
export function SidebarSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("space-y-1", className)}>
      <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-label">
        {title}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
