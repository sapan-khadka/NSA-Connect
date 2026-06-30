import type { MemberResponse } from "../lib/auth-api";
import {
  formatPositionLabel,
  isExclusiveMemberPosition,
  MEMBER_POSITIONS,
  type MemberPosition,
} from "../lib/roles";

type PositionHolder = { id: number; full_name: string };

type PositionSelectProps = {
  member: MemberResponse;
  isUpdating?: boolean;
  positionHolders?: Partial<Record<MemberPosition, PositionHolder>>;
  onPositionChange: (
    memberId: number,
    position: MemberPosition,
  ) => void | Promise<void>;
};

function formatPositionOptionLabel(
  position: MemberPosition,
  member: MemberResponse,
  positionHolders?: Partial<Record<MemberPosition, PositionHolder>>,
): string {
  const label = formatPositionLabel(position);
  const holder = positionHolders?.[position];

  if (
    holder &&
    holder.id !== member.id &&
    isExclusiveMemberPosition(position)
  ) {
    return `${label} (${holder.full_name})`;
  }

  return label;
}

export function PositionSelect({
  member,
  isUpdating = false,
  positionHolders,
  onPositionChange,
}: PositionSelectProps) {
  return (
    <label className="inline-flex flex-col gap-1">
      <span className="sr-only">Position for {member.full_name}</span>
      <select
        value={member.position}
        disabled={isUpdating || member.status !== "approved"}
        onChange={(event) => {
          const nextPosition = event.target.value as MemberPosition;
          if (nextPosition !== member.position) {
            void onPositionChange(member.id, nextPosition);
          }
        }}
        aria-label={`Change position for ${member.full_name}`}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {MEMBER_POSITIONS.map((position) => (
          <option key={position} value={position}>
            {formatPositionOptionLabel(position, member, positionHolders)}
          </option>
        ))}
      </select>
    </label>
  );
}
