import type { EventResponse } from "../lib/events-api";
import {
  getFinanceCloseoutMessage,
  getEventFinanceStatusClass,
  getEventFinanceStatusLabel,
  formatFinanceLockDeadline,
} from "../lib/event-finance";
import { Card } from "./ui/Card";

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
    ? "bg-surface-muted text-foreground"
    : "bg-urgent/20 text-foreground";

  return (
    <Card aria-live="polite" padding="sm" className={toneClass}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm">
          {event.is_finance_locked ? "Post-event close-out complete" : "Finance close-out window"}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${getEventFinanceStatusClass(event)}`}
        >
          {getEventFinanceStatusLabel(event)}
        </span>
      </div>
      <p className="mt-2 text-sm">{message}</p>
      {event.is_finance_grace_period ? (
        <p className="mt-2 text-xs text-label">
          Closes {formatFinanceLockDeadline(event.finance_lock_at)}
        </p>
      ) : null}
    </Card>
  );
}
