import {
  formatRoleLabel,
  getRoleBadgeClassName,
  isMemberRole,
  type MemberRole,
  type RoleBadgeSize,
} from "../lib/roles";

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
          "inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-700",
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
    <span
      className={[getRoleBadgeClassName(role, size), className]
        .filter(Boolean)
        .join(" ")}
    >
      {formatRoleLabel(role)}
    </span>
  );
}
