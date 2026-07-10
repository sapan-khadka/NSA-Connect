import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { cx } from "../../cx";

export type BreadcrumbItem = {
  id: string;
  label: ReactNode;
  to?: string;
  href?: string;
};

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
  /** Separator between items. Defaults to a chevron. */
  separator?: ReactNode;
  className?: string;
  /** Accessible name for the nav. */
  label?: string;
};

/**
 * Breadcrumb trail. Last item is the current page (no link).
 */
export function Breadcrumb({
  items,
  separator,
  className = "",
  label = "Breadcrumb",
}: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  const sep =
    separator ?? (
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-label"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    );

  return (
    <nav aria-label={label} className={cx("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.id} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? sep : null}
              {isLast || (!item.to && !item.href) ? (
                <span
                  className="truncate font-medium text-foreground"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : item.to ? (
                <Link
                  to={item.to}
                  className="truncate text-label transition-colors hover:text-primary"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  href={item.href}
                  className="truncate text-label transition-colors hover:text-primary"
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
