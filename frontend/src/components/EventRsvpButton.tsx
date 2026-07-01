import { useRef } from "react";

import type { RsvpStatus } from "../lib/events-api";
import { formatRsvpStatus, RSVP_STATUS_LABELS } from "../lib/event-rsvp";
import {
  playGoingBurst,
  playMaybeWobble,
  playNotGoingCries,
} from "../lib/rsvp-reactions";

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: RSVP_STATUS_LABELS.going },
  { value: "maybe", label: RSVP_STATUS_LABELS.maybe },
  { value: "not_going", label: RSVP_STATUS_LABELS.not_going },
];

const NOT_GOING_MESSAGE = "Aww, we'll miss you. See you next time.";

type EventRsvpButtonProps = {
  currentStatus: RsvpStatus | null;
  canRsvp: boolean;
  loading: boolean;
  onStatusChange: (status: RsvpStatus) => void;
};

function buttonClass(isSelected: boolean): string {
  const base =
    "w-full min-w-0 rounded-pill px-3 py-2.5 text-center text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  if (isSelected) {
    return `${base} bg-primary text-white`;
  }

  return `${base} bg-surface-muted text-foreground hover:bg-surface-card`;
}

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

export function EventRsvpButton({
  currentStatus,
  canRsvp,
  loading,
  onStatusChange,
}: EventRsvpButtonProps) {
  const buttonRefs = useRef<Partial<Record<RsvpStatus, HTMLButtonElement>>>({});
  const showPrompt = canRsvp && currentStatus === null;

  function handleOptionClick(status: RsvpStatus): void {
    const anchor = buttonRefs.current[status];
    if (anchor) {
      playReaction(status, anchor);
    }
    onStatusChange(status);
  }

  return (
    <div className="ds-card p-3">
      <p className="text-sm text-foreground">Your RSVP</p>

      {showPrompt ? (
        <p
          role="status"
          className="mt-2 rounded-md border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm text-foreground"
        >
          You haven&apos;t RSVP&apos;d yet — let us know if you plan to attend.
        </p>
      ) : null}

      {canRsvp ? (
        <>
          <div
            role="group"
            aria-label="RSVP options"
            className="mt-3 flex gap-2"
          >
            {RSVP_OPTIONS.map((option) => {
              const isSelected = currentStatus === option.value;
              return (
                <div
                  key={option.value}
                  data-rsvp-reaction-host
                  className="relative flex-1 min-w-0 overflow-visible"
                >
                  <button
                    ref={(element) => {
                      buttonRefs.current[option.value] = element ?? undefined;
                    }}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={loading}
                    onClick={() => handleOptionClick(option.value)}
                    className={buttonClass(isSelected)}
                  >
                    {loading && isSelected ? "Updating…" : option.label}
                  </button>
                </div>
              );
            })}
          </div>

          {currentStatus === "not_going" ? (
            <p className="mt-2 text-sm text-label" role="status">
              {NOT_GOING_MESSAGE}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-label">
          {currentStatus
            ? `Your response: ${formatRsvpStatus(currentStatus)}.`
            : "RSVP is closed for past events."}
        </p>
      )}
    </div>
  );
}
