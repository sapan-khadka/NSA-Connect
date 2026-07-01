import {
  formatRoleLabel,
  getRoleBadgeClassName,
  isMemberRole,
  type MemberRole,
  type RoleBadgeSize,
} from "../lib/roles";
import { getRoleBadgeIcon } from "../lib/role-badge-icons";
import { RoleBadgePill } from "./RoleBadgePill";

type RoleBadgeProps = {
  role: MemberRole | string;
  size?: RoleBadgeSize;
  className?: string;
};

export function RoleBadge({ role, size = "sm", className }: RoleBadgeProps) {
  if (!isMemberRole(role)) {
    return (
      <span
        className={[
          "inline-flex items-center gap-1.5 rounded-pill bg-roleBadge-general-bg py-1 px-2.5 text-xs font-medium text-roleBadge-general",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {role}
      </span>
    );
  }

  return (
    <RoleBadgePill
      label={formatRoleLabel(role)}
      icon={getRoleBadgeIcon(role)}
      size={size}
      className={[getRoleBadgeClassName(role, size), className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
