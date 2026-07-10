import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { AppIcon } from "./AppIcon";

type SectionLabelProps = {
  children: ReactNode;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
};

export function SectionLabel({
  children,
  icon,
  iconClassName = "text-label",
  className,
}: SectionLabelProps) {
  return (
    <p
      className={["ds-section-label ds-icon-label", className]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? <AppIcon icon={icon} size="sm" className={iconClassName} /> : null}
      {children}
    </p>
  );
}
