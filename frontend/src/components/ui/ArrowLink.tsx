import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { AppIcon } from "./AppIcon";

type ArrowLinkProps = {
  to: string;
  children: string;
  className?: string;
};

export function ArrowLink({ to, children, className = "" }: ArrowLinkProps) {
  return (
    <Link to={to} className={["ds-link", className].join(" ")}>
      {children}
      <AppIcon icon={ChevronRight} size="sm" className="text-current" />
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
      className={["ds-link", className].join(" ")}
    >
      {children}
      <AppIcon icon={ChevronRight} size="sm" className="text-current" />
    </button>
  );
}
