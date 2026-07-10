import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../cx";

export type SidebarProps = HTMLAttributes<HTMLElement> & {
  /** Brand / logo area at the top. */
  header?: ReactNode;
  /** Primary navigation (sections + SidebarItem lists). */
  children: ReactNode;
  /** Account / footer area at the bottom (stays pinned). */
  footer?: ReactNode;
  /** Accessible name for the nav landmark. */
  navLabel?: string;
};

/**
 * Fixed-width CampusOS sidebar shell (`--sidebar-width`, default 240px).
 * Nav scrolls independently; header and footer stay pinned.
 */
export function Sidebar({
  header,
  children,
  footer,
  navLabel = "Primary",
  className = "",
  ...rest
}: SidebarProps) {
  return (
    <aside
      className={cx(
        "flex h-full w-[var(--sidebar-width)] flex-col border-r border-gray-200 bg-surface-card",
        className,
      )}
      {...rest}
    >
      {header ? (
        <div className="shrink-0 border-b border-gray-100 px-4 pb-4 pt-5">
          {header}
        </div>
      ) : null}

      <nav
        aria-label={navLabel}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {children}
      </nav>

      {footer ? (
        <div className="shrink-0 border-t border-gray-100 px-3 pb-4 pt-3">
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
