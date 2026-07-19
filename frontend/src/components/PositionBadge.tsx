import {
  formatPositionLabel,
  getCustomPositionBadgeClassName,
  getPositionBadgeClassName,
  isExclusiveMemberPosition,
  type MemberPosition,
  type RoleBadgeSize,
} from "../lib/roles";
import {
  getCustomPositionBadgeIcon,
  getPositionBadgeIcon,
} from "../lib/role-badge-icons";
import { RoleBadgePill } from "./RoleBadgePill";

type PositionBadgeProps = {
  position: MemberPosition;
  customPositionName?: string | null;
  size?: RoleBadgeSize;
  className?: string;
};

export function PositionBadge({
  position,
  customPositionName,
  size = "sm",
  className,
}: PositionBadgeProps) {
  if (customPositionName) {
    const icon = getCustomPositionBadgeIcon();
    return (
      <RoleBadgePill
        label={customPositionName}
        icon={icon}
        size={size}
        className={[getCustomPositionBadgeClassName(size), className]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

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

export function MemberPositionBadge({
  member,
  size = "sm",
  className,
}: {
  member: {
    position: MemberPosition;
    custom_board_position?: { name: string } | null;
  };
  size?: RoleBadgeSize;
  className?: string;
}) {
  return (
    <PositionBadge
      position={member.position}
      customPositionName={member.custom_board_position?.name}
      size={size}
      className={className}
    />
  );
}
