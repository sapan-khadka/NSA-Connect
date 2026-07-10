import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { cx } from "../../cx";
import { Avatar } from "../Avatar";
import { useDismissibleMenu } from "./useDismissibleMenu";

export type ProfileMenuItem = {
  id: string;
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "danger";
};

export type ProfileMenuProps = {
  name: string;
  /** Secondary line under the name (role, email). */
  subtitle?: string;
  avatarSrc?: string | null;
  items: ProfileMenuItem[];
  /** Avatar-only trigger (no name in the button). */
  avatarOnly?: boolean;
  align?: "left" | "right";
  className?: string;
  /** Custom trigger node. */
  trigger?: ReactNode;
};

/**
 * Profile / account menu. Configurable items; no auth coupling.
 */
export function ProfileMenu({
  name,
  subtitle,
  avatarSrc,
  items,
  avatarOnly = false,
  align = "right",
  className = "",
  trigger,
}: ProfileMenuProps) {
  const { open, setOpen, rootRef, menuId } = useDismissibleMenu();

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      {trigger ? (
        <span
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((current) => !current);
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          aria-label={`Account menu for ${name}`}
        >
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          aria-label={`Account menu for ${name}`}
          onClick={() => setOpen((current) => !current)}
          className={cx(
            "flex items-center gap-2 rounded-xl text-left transition duration-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            avatarOnly ? "p-0.5" : "px-2 py-1.5",
          )}
        >
          <Avatar name={name} src={avatarSrc} size="sm" />
          {!avatarOnly ? (
            <>
              <span className="min-w-0 hidden sm:block">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {name.split(/\s+/)[0] ?? name}
                </span>
                {subtitle ? (
                  <span className="block truncate text-xs text-label">
                    {subtitle}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className="hidden h-3.5 w-3.5 text-label sm:block"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </>
          ) : null}
        </button>
      )}

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className={cx(
            "absolute top-full z-50 mt-2 min-w-[12rem] overflow-hidden rounded-card border border-gray-200 bg-surface-card py-1 shadow-card",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="border-b border-gray-200 px-3 py-2.5 sm:hidden">
            <p className="truncate text-sm font-semibold text-foreground">
              {name}
            </p>
            {subtitle ? (
              <p className="truncate text-xs text-label">{subtitle}</p>
            ) : null}
          </div>

          {items.map((item) => {
            const itemClass = cx(
              "block w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-muted",
              item.tone === "danger" ? "text-overdue" : "text-foreground",
            );

            function activate() {
              item.onClick?.();
              setOpen(false);
            }

            if (item.to) {
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  role="menuitem"
                  className={itemClass}
                  onClick={activate}
                >
                  {item.label}
                </Link>
              );
            }

            if (item.href) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  className={itemClass}
                  onClick={activate}
                >
                  {item.label}
                </a>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={activate}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
