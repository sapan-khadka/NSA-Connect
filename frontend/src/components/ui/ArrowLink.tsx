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
