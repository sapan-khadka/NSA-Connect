/**
 * Full-width 3-segment RSVP control for the calendar event sidebar.
 * Presentation only — status updates go through onStatusChange.
 */

import { useEffect, useRef, useState } from "react";

import type { RsvpStatus } from "../lib/events-api";
import { formatRsvpStatus } from "../lib/event-rsvp";
import {
  playGoingBurst,
  playMaybeWobble,
  playNotGoingCries,
} from "../lib/rsvp-reactions";

const RSVP_SEGMENTS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Can't Go" },
];

export type EventRsvpSegmentedProps = {
  currentStatus: RsvpStatus | null;
  canRsvp: boolean;
  loading: boolean;
  onStatusChange: (status: RsvpStatus) => void;
};

function playReaction(status: RsvpStatus, anchor: HTMLElement): void {
  if (status === "going") {
    playGoingBurst(anchor);
    return;
  }
  if (status === "maybe") {
    playMaybeWobble(anchor);
    return;
  }
  playNotGoingCries(anchor);
}

function segmentClass(isSelected: boolean): string {
  return [
    "rsvp-segmented-btn",
    isSelected ? "rsvp-segmented-btn--selected" : "rsvp-segmented-btn--idle",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ].join(" ");
}

export function EventRsvpSegmented({
  currentStatus,
  canRsvp,
  loading,
  onStatusChange,
}: EventRsvpSegmentedProps) {
  const buttonRefs = useRef<Partial<Record<RsvpStatus, HTMLButtonElement>>>({});
  const [displayStatus, setDisplayStatus] = useState<RsvpStatus | null>(
    currentStatus,
  );

  useEffect(() => {
    setDisplayStatus(currentStatus);
  }, [currentStatus]);

  if (!canRsvp) {
    return (
      <p className="text-sm text-label">
        {displayStatus
          ? `Your response: ${formatRsvpStatus(displayStatus)}.`
          : "RSVP is closed for past events."}
      </p>
    );
  }

  function handleOptionClick(status: RsvpStatus): void {
    setDisplayStatus(status);
    const anchor = buttonRefs.current[status];
    if (anchor) {
      playReaction(status, anchor);
    }
    onStatusChange(status);
  }

  return (
    <div
      role="group"
      aria-label="RSVP options"
      className="rsvp-segmented rsvp-segmented--equal"
    >
      {RSVP_SEGMENTS.map((option) => {
        const isSelected = displayStatus === option.value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttonRefs.current[option.value] = element ?? undefined;
            }}
            type="button"
            data-rsvp-reaction-host
            aria-pressed={isSelected}
            disabled={loading}
            onClick={() => handleOptionClick(option.value)}
            className={segmentClass(isSelected)}
          >
            <span className="truncate">
              {loading && isSelected ? "Updating…" : option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
