import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../cx";

export type TopHeaderProps = HTMLAttributes<HTMLElement> & {
  /** Left slot (menu button, brand, breadcrumbs). */
  leading?: ReactNode;
  /** Center slot — typically SearchBar. */
  center?: ReactNode;
  /** Right slot (notifications, profile). */
  actions?: ReactNode;
};

/**
 * App top header shell. Sticky bar with leading / center / actions regions.
 */
export function TopHeader({
  leading,
  center,
  actions,
  className = "",
  children,
  ...rest
}: TopHeaderProps) {
  return (
    <header
      className={cx(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-surface-card/90 px-4 backdrop-blur-md sm:px-6 lg:px-8",
        className,
      )}
      {...rest}
    >
      {leading ? <div className="flex shrink-0 items-center">{leading}</div> : null}

      {center ? (
        <div className="relative mx-auto min-w-0 w-full max-w-2xl flex-1">
          {center}
        </div>
      ) : null}

      {children}

      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
