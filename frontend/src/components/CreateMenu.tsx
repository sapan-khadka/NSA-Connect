import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import {
  canManageTreasury,
  canViewMemberDirectory,
  isRoleAtLeast,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";

type CreateItem = {
  id: string;
  label: string;
  to?: string;
  onSelect?: () => void;
};

type CreateMenuProps = {
  onLogTransaction?: () => void;
  className?: string;
};

/**
 * Global "+ Create" control — one place for Event / Announcement / Member / Transaction.
 */
export function CreateMenu({ onLogTransaction, className = "" }: CreateMenuProps) {
  const { member } = useAuth();
  const navigate = useNavigate();
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

  if (!member) {
    return null;
  }

  const items: CreateItem[] = [];

  if (isRoleAtLeast(member.role, "board")) {
    items.push({ id: "event", label: "Event", to: "/events/calendar" });
    items.push({ id: "announcement", label: "Announcement", to: "/announcements" });
  }

  if (canViewMemberDirectory(member.role)) {
    items.push({ id: "member", label: "Member", to: "/members?tab=pending" });
  }

  if (canManageTreasury(member.role, member.position)) {
    items.push({
      id: "transaction",
      label: "Transaction",
      onSelect: onLogTransaction,
      to: onLogTransaction ? undefined : "/finance",
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className={["relative shrink-0", className].join(" ")}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
      >
        <AppIcon icon={Plus} size="sm" className="text-current" />
        Create
        <AppIcon icon={ChevronDown} size="xs" className="text-current opacity-80" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] ds-card py-1"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-muted hover:text-primary"
              onClick={() => {
                setOpen(false);
                if (item.onSelect) {
                  item.onSelect();
                  return;
                }
                if (item.to) {
                  navigate(item.to);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
