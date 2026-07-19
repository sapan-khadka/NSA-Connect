import { useEffect, useMemo, useState } from "react";

import type { MemberResponse } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchMemberPositionCatalog,
  type CustomBoardPositionRecord,
  type MemberPositionAssignment,
  type MemberPositionCatalog,
} from "../lib/members-api";
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
  catalog?: MemberPositionCatalog | null;
  onPositionChange: (
    memberId: number,
    assignment: MemberPositionAssignment,
  ) => void | Promise<void>;
};

function fixedValue(position: MemberPosition): string {
  return `fixed:${position}`;
}

function customValue(positionId: number): string {
  return `custom:${positionId}`;
}

function currentSelectValue(member: MemberResponse): string {
  if (member.custom_board_position) {
    return customValue(member.custom_board_position.id);
  }
  return fixedValue(member.position);
}

function formatFixedOptionLabel(
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

function formatCustomOptionLabel(
  position: CustomBoardPositionRecord,
  member: MemberResponse,
): string {
  if (position.holder && position.holder.id !== member.id) {
    return `${position.name} (${position.holder.full_name})`;
  }
  return position.name;
}

function parseAssignment(value: string): MemberPositionAssignment | null {
  if (value.startsWith("fixed:")) {
    const position = value.slice("fixed:".length) as MemberPosition;
    if (!MEMBER_POSITIONS.includes(position)) {
      return null;
    }
    return { kind: "fixed", position };
  }
  if (value.startsWith("custom:")) {
    const id = Number(value.slice("custom:".length));
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    return { kind: "custom", custom_board_position_id: id };
  }
  return null;
}

export function PositionSelect({
  member,
  isUpdating = false,
  positionHolders,
  catalog: catalogProp,
  onPositionChange,
}: PositionSelectProps) {
  const [loadedCatalog, setLoadedCatalog] = useState<MemberPositionCatalog | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (catalogProp) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const catalog = await fetchMemberPositionCatalog();
        if (!cancelled) {
          setLoadedCatalog(catalog);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(error));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogProp]);

  const catalog = catalogProp ?? loadedCatalog;
  const customPositions = useMemo(
    () => (catalog?.custom ?? []).filter((position) => position.is_active),
    [catalog],
  );

  const selectValue = currentSelectValue(member);
  const hasCustomOption =
    member.custom_board_position != null &&
    !customPositions.some(
      (position) => position.id === member.custom_board_position?.id,
    );

  return (
    <label className="inline-flex flex-col gap-1">
      <span className="sr-only">Position for {member.full_name}</span>
      <select
        value={selectValue}
        disabled={isUpdating || member.status !== "approved"}
        onChange={(event) => {
          const assignment = parseAssignment(event.target.value);
          if (!assignment) {
            return;
          }
          const current = currentSelectValue(member);
          if (event.target.value !== current) {
            void onPositionChange(member.id, assignment);
          }
        }}
        aria-label={`Change position for ${member.full_name}`}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {(catalog?.built_in.map((item) => item.key) ?? MEMBER_POSITIONS).map(
          (position) => (
            <option key={fixedValue(position)} value={fixedValue(position)}>
              {formatFixedOptionLabel(position, member, positionHolders)}
            </option>
          ),
        )}
        {customPositions.map((position) => (
          <option key={customValue(position.id)} value={customValue(position.id)}>
            {formatCustomOptionLabel(position, member)}
          </option>
        ))}
        {hasCustomOption && member.custom_board_position ? (
          <option
            value={customValue(member.custom_board_position.id)}
          >
            {member.custom_board_position.name}
          </option>
        ) : null}
      </select>
      {loadError ? (
        <span className="text-xs text-destructive" role="alert">
          {loadError}
        </span>
      ) : null}
    </label>
  );
}
