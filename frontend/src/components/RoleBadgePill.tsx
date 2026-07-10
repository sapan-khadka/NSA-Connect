import type { LucideIcon } from "lucide-react";

import type { RoleBadgeSize } from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";

type RoleBadgePillProps = {
  label: string;
  icon: LucideIcon;
  className: string;
  size?: RoleBadgeSize;
};

export function RoleBadgePill({
  label,
  icon,
  className,
  size = "sm",
}: RoleBadgePillProps) {
  return (
    <span className={className}>
      <AppIcon icon={icon} size={size === "md" ? "sm" : "xs"} />
      {label}
    </span>
  );
}
