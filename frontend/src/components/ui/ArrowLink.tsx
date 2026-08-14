import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { AppIcon } from "./AppIcon";

type ArrowLinkProps = {
  to: string;
  children: string;
  className?: string;
};

/**
 * Compact section “View all” / trailing nav control.
 * Shared token: `.ds-view-all` (same hover + type everywhere).
 */
export function ArrowLink({ to, children, className = "" }: ArrowLinkProps) {
  return (
    <Link
      to={to}
      className={["ds-view-all", className].filter(Boolean).join(" ")}
    >
      {children}
      <AppIcon icon={ChevronRight} size="xs" className="text-current" />
    </Link>
  );
}

/** Same visual language as ArrowLink, for opening modals/drawers in place. */
export function ArrowAction({
  onClick,
  children,
  className = "",
}: {
  onClick: () => void;
  children: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={["ds-view-all", className].filter(Boolean).join(" ")}
    >
      {children}
      <AppIcon icon={ChevronRight} size="xs" className="text-current" />
    </button>
  );
}
