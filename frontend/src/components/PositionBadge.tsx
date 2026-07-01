import {
  formatPositionLabel,
  getPositionBadgeClassName,
  isExclusiveMemberPosition,
  type MemberPosition,
  type RoleBadgeSize,
} from "../lib/roles";
import { getPositionBadgeIcon } from "../lib/role-badge-icons";
import { RoleBadgePill } from "./RoleBadgePill";

type PositionBadgeProps = {
  position: MemberPosition;
  size?: RoleBadgeSize;
  className?: string;
};

export function PositionBadge({
  position,
  size = "sm",
  className,
}: PositionBadgeProps) {
  if (!isExclusiveMemberPosition(position)) {
    return null;
  }

  const icon = getPositionBadgeIcon(position);
  if (!icon) {
    return null;
  }

  return (
    <RoleBadgePill
      label={formatPositionLabel(position)}
      icon={icon}
      size={size}
      className={[getPositionBadgeClassName(position, size), className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
