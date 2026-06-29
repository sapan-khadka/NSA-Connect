import type { MemberResponse } from "../lib/auth-api";
import {
  formatPositionLabel,
  MEMBER_POSITIONS,
  type MemberPosition,
} from "../lib/roles";

type PositionSelectProps = {
  member: MemberResponse;
  isUpdating?: boolean;
  onPositionChange: (
    memberId: number,
    position: MemberPosition,
  ) => void | Promise<void>;
};

export function PositionSelect({
  member,
  isUpdating = false,
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
            {formatPositionLabel(position)}
          </option>
        ))}
      </select>
    </label>
  );
}
