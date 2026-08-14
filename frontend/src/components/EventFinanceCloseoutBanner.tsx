import type { EventResponse } from "../lib/events-api";
import {
  getFinanceCloseoutMessage,
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

  return (
    <section className="event-command-section" aria-live="polite">
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">
          {event.is_finance_locked ? "Close-out" : "Finance"}
        </h2>
        <p className="event-command-status">
          {getEventFinanceStatusLabel(event)}
        </p>
      </div>
      <p className="event-command-stat">{message}</p>
      {event.is_finance_grace_period ? (
        <p className="event-command-stat">
          Closes {formatFinanceLockDeadline(event.finance_lock_at)}
        </p>
      ) : null}
    </section>
  );
}
