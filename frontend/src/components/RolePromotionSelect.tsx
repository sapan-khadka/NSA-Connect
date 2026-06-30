import type { MemberResponse } from "../lib/auth-api";
import {
  formatRoleLabel,
  isExclusiveMemberPosition,
  PROMOTABLE_BOARD_ROLES,
  type PromotableBoardRole,
} from "../lib/roles";

import { PositionBadge } from "./PositionBadge";
import { RoleBadge } from "./RoleBadge";

type RolePromotionSelectProps = {
  member: MemberResponse;
  isUpdating?: boolean;
  onRoleChange: (
    memberId: number,
    role: PromotableBoardRole,
  ) => void | Promise<void>;
};

export function RolePromotionSelect({
  member,
  isUpdating = false,
  onRoleChange,
}: RolePromotionSelectProps) {
  if (isExclusiveMemberPosition(member.position)) {
    return <PositionBadge position={member.position} />;
  }

  if (member.role !== "general" && member.role !== "board") {
    return <RoleBadge role={member.role} />;
  }

  return (
    <label className="inline-flex flex-col gap-1">
      <span className="sr-only">Role for {member.full_name}</span>
      <select
        value={member.role}
        disabled={isUpdating || member.status !== "approved"}
        onChange={(event) => {
          const nextRole = event.target.value as PromotableBoardRole;
          if (nextRole !== member.role) {
            void onRoleChange(member.id, nextRole);
          }
        }}
        aria-label={`Change role for ${member.full_name}`}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {PROMOTABLE_BOARD_ROLES.map((role) => (
          <option key={role} value={role}>
            {formatRoleLabel(role)}
          </option>
        ))}
      </select>
    </label>
  );
}
