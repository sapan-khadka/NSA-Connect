/**
 * Horizontal overlapping attendee avatars with a “View attendees” action.
 * Purely presentational — parent supplies people and the view handler.
 */

import { Avatar } from "../design-system/components/Avatar";

export type EventAttendeeStackPerson = {
  id: number | string;
  name: string;
  photoUrl?: string | null;
};

export type EventAttendeeStackProps = {
  attendees: EventAttendeeStackPerson[];
  /** Total count for the +N bubble (defaults to attendees.length). */
  totalCount?: number;
  /** Max faces shown before +N (default 4). */
  maxVisible?: number;
  onViewAttendees: () => void;
  viewLabel?: string;
  className?: string;
};

const DEFAULT_MAX_VISIBLE = 4;

export function EventAttendeeStack({
  attendees,
  totalCount,
  maxVisible = DEFAULT_MAX_VISIBLE,
  onViewAttendees,
  viewLabel = "View attendees",
  className = "",
}: EventAttendeeStackProps) {
  if (attendees.length === 0 && (totalCount == null || totalCount <= 0)) {
    return null;
  }

  const total = totalCount ?? attendees.length;
  const visible = attendees.slice(0, maxVisible);
  const overflow = Math.max(0, total - visible.length);

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center" aria-hidden="true">
        {visible.map((person, index) => (
          <span
            key={person.id}
            className="relative inline-flex rounded-full ring-2 ring-white"
            style={{
              marginLeft: index === 0 ? 0 : -8,
              zIndex: visible.length - index,
            }}
          >
            <Avatar
              name={person.name}
              src={person.photoUrl}
              size="sm"
              className="h-7 w-7 text-[10px]"
            />
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className="relative inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-label ring-2 ring-white"
            style={{ marginLeft: visible.length > 0 ? -8 : 0, zIndex: 0 }}
          >
            +{overflow}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        className="text-[12px] font-medium text-label transition-colors duration-150 hover:text-foreground"
        onClick={onViewAttendees}
      >
        {viewLabel} →
      </button>
    </div>
  );
}
