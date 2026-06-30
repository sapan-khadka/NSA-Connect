import type { EventResponse } from "../lib/events-api";
import {
  getFinanceCloseoutMessage,
  getEventFinanceStatusClass,
  getEventFinanceStatusLabel,
  formatFinanceLockDeadline,
} from "../lib/event-finance";

type EventFinanceCloseoutBannerProps = {
  event: EventResponse;
};

export function EventFinanceCloseoutBanner({
  event,
}: EventFinanceCloseoutBannerProps) {
  const message = getFinanceCloseoutMessage(event);
  if (!message) {
    return null;
  }

  const toneClass = event.is_finance_locked
    ? "border-gray-200 bg-gray-50 text-gray-700"
    : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <section
      aria-live="polite"
      className={`rounded-lg border p-4 ${toneClass}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">
          {event.is_finance_locked ? "Post-event close-out complete" : "Finance close-out window"}
        </p>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getEventFinanceStatusClass(event)}`}
        >
          {getEventFinanceStatusLabel(event)}
        </span>
      </div>
      <p className="mt-2 text-sm">{message}</p>
      {event.is_finance_grace_period ? (
        <p className="mt-2 text-xs opacity-80">
          Closes {formatFinanceLockDeadline(event.finance_lock_at)}
        </p>
      ) : null}
    </section>
  );
}
