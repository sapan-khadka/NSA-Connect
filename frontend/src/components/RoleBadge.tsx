import type { MemberRole } from "../lib/roles";
import { formatRoleLabel } from "../lib/roles";

const ROLE_STYLES: Record<MemberRole, string> = {
  president: "border-purple-200 bg-purple-50 text-purple-800",
  treasurer: "border-blue-200 bg-blue-50 text-blue-800",
  board: "border-accent/30 bg-accent/10 text-accent",
  general: "border-gray-200 bg-gray-50 text-gray-700",
};

type RoleBadgeProps = {
  role: MemberRole;
};

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${ROLE_STYLES[role]}`}
    >
      {formatRoleLabel(role)}
    </span>
  );
}
