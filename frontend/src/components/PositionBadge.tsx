import {
  formatPositionLabel,
  getPositionBadgeClassName,
  isExclusiveMemberPosition,
  type MemberPosition,
  type RoleBadgeSize,
} from "../lib/roles";

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

  return (
    <span
      className={[getPositionBadgeClassName(position, size), className]
        .filter(Boolean)
        .join(" ")}
    >
      {formatPositionLabel(position)}
    </span>
  );
}
