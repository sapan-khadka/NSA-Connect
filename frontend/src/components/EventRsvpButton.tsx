type EventRsvpButtonProps = {
  hasRsvped: boolean;
  rsvpCount: number;
  canRsvp: boolean;
  loading: boolean;
  onRsvp: () => void;
  onCancelRsvp: () => void;
};

export function EventRsvpButton({
  hasRsvped,
  rsvpCount,
  canRsvp,
  loading,
  onRsvp,
  onCancelRsvp,
}: EventRsvpButtonProps) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm text-gray-600">
        {rsvpCount === 1 ? "1 member going" : `${rsvpCount} members going`}
      </p>

      {canRsvp ? (
        hasRsvped ? (
          <button
            type="button"
            disabled={loading}
            onClick={onCancelRsvp}
            className="mt-3 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-accent hover:bg-accent/5 disabled:opacity-60"
          >
            {loading ? "Updating…" : "Cancel RSVP"}
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={onRsvp}
            className="mt-3 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Updating…" : "RSVP"}
          </button>
        )
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          {hasRsvped ? "You are going to this event." : "RSVP is closed for past events."}
        </p>
      )}
    </div>
  );
}
