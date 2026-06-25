import type { MemberResponse } from "../lib/auth-api";
import { formatRoleLabel } from "../lib/roles";

type PrepTaskAssigneeSelectProps = {
  assigneeId: number | null;
  assignableMembers: MemberResponse[];
  disabled?: boolean;
  onAssign: (assigneeId: number | null) => void;
};

export function PrepTaskAssigneeSelect({
  assigneeId,
  assignableMembers,
  disabled = false,
  onAssign,
}: PrepTaskAssigneeSelectProps) {
  return (
    <label className="mt-2 block text-sm">
      <span className="text-gray-500">Assignee</span>
      <select
        value={assigneeId ?? ""}
        disabled={disabled}
        aria-label="Assign prep task"
        onChange={(event) => {
          const value = event.target.value;
          onAssign(value === "" ? null : Number(value));
        }}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-primary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {assignableMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.full_name} ({formatRoleLabel(member.role)})
          </option>
        ))}
      </select>
    </label>
  );
}
