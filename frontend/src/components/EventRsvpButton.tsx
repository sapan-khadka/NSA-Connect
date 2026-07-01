import type { RsvpStatus } from "../lib/events-api";
import { formatRsvpStatus, RSVP_STATUS_LABELS } from "../lib/event-rsvp";

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "going", label: RSVP_STATUS_LABELS.going },
  { value: "maybe", label: RSVP_STATUS_LABELS.maybe },
  { value: "not_going", label: RSVP_STATUS_LABELS.not_going },
];

type EventRsvpButtonProps = {
  currentStatus: RsvpStatus | null;
  canRsvp: boolean;
  loading: boolean;
  onStatusChange: (status: RsvpStatus) => void;
};

function buttonClass(isSelected: boolean): string {
  const base =
    "flex-1 min-w-0 rounded-pill px-3 py-2.5 text-center text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60";

  if (isSelected) {
    return `${base} bg-primary text-white`;
  }

  return `${base} bg-surface-muted text-foreground hover:bg-surface-card`;
}

export function EventRsvpButton({
  currentStatus,
  canRsvp,
  loading,
  onStatusChange,
}: EventRsvpButtonProps) {
  return (
    <div className="ds-card p-3">
      <p className="text-sm text-foreground">Your RSVP</p>

      {canRsvp ? (
        <div
          role="group"
          aria-label="RSVP options"
          className="mt-3 flex gap-2"
        >
          {RSVP_OPTIONS.map((option) => {
            const isSelected = currentStatus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                disabled={loading}
                onClick={() => onStatusChange(option.value)}
                className={buttonClass(isSelected)}
              >
                {loading && isSelected ? "Updating…" : option.label}
              </button>
            );
          })}
        </div>
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
