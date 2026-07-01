import type { LucideIcon } from "lucide-react";

import type { RoleBadgeSize } from "../lib/roles";

const ICON_SIZE: Record<RoleBadgeSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

type RoleBadgePillProps = {
  label: string;
  icon: LucideIcon;
  className: string;
  size?: RoleBadgeSize;
};

export function RoleBadgePill({
  label,
  icon: Icon,
  className,
  size = "sm",
}: RoleBadgePillProps) {
  return (
    <span className={className}>
      <Icon
        className={ICON_SIZE[size]}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
