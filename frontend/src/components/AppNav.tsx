import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";

type NavDropdownItem = {
  label: string;
  to: string;
};

export function buildNavPillClass(isActive: boolean): string {
  return isActive ? "ds-nav-pill ds-nav-pill--active" : "ds-nav-pill";
}

type NavDropdownProps = {
  label: string;
  items: NavDropdownItem[];
  isActive?: boolean;
};

export function NavDropdown({ label, items, isActive = false }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLLIElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (items.length === 0) {
    return null;
  }

  return (
    <li ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={buildNavPillClass(isActive || open)}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[11rem] ds-card py-1 "
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive: itemActive }) =>
                [
                  "block px-3 py-2 text-sm transition-colors",
                  itemActive
                    ? "bg-accent/5 font-medium text-accent"
                    : "text-foreground hover:bg-surface-card hover:text-accent",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

type AccountMenuProps = {
  fullName: string;
  onLogout: () => void;
};

export function AccountMenu({ fullName, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Account menu for ${fullName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 ds-card px-2.5 py-1.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-medium text-accent"
        >
          {getInitials(fullName)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-foreground sm:block">
          {fullName}
        </span>
        <span aria-hidden="true" className="text-[10px] text-label">
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 ds-card py-1 "
        >
          <div className="border-b border-gray-100 px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-medium text-foreground">{fullName}</p>
          </div>
          <NavLink
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              [
                "block px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent/5 font-medium text-accent"
                  : "text-foreground hover:bg-surface-card hover:text-accent",
              ].join(" ")
            }
          >
            Account settings
          </NavLink>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-card hover:text-accent"
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function NavDivider() {
  return (
    <li
      aria-hidden="true"
      className="mx-1 hidden h-5 w-px bg-gray-200 md:block"
    />
  );
}

type PrimaryNavLinkProps = {
  to: string;
  end?: boolean;
  children: ReactNode;
};

export function PrimaryNavLink({ to, end = false, children }: PrimaryNavLinkProps) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) => buildNavPillClass(isActive)}
      >
        {children}
      </NavLink>
    </li>
  );
}
