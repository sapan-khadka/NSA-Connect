import {
  budgetDisplayPercent,
  budgetProgressBarClass,
  budgetUsagePercent,
  formatBudgetSpentLabel,
  type EventBudgetRow,
} from "../lib/event-budget";
import { parseCurrencyAmount } from "../lib/format-currency";

type EventBudgetBreakdownProps = {
  events: EventBudgetRow[];
  isLoading: boolean;
  errorMessage: string | null;
  /** When set, each event row opens that event's Books ledger. */
  onEventClick?: (eventId: number) => void;
};

function percentLabel(event: EventBudgetRow): string {
  if (parseCurrencyAmount(event.planned_budget) <= 0) {
    return "—";
  }

  return `${budgetDisplayPercent(event.planned_budget, event.actual_expense)}%`;
}

export function EventBudgetBreakdown({
  events,
  isLoading,
  errorMessage,
  onEventClick,
}: EventBudgetBreakdownProps) {
  if (isLoading) {
    return (
      <div className="finance-chart-card">
        <p className="finance-meter-empty">Loading event budgets…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div role="alert" className="ds-alert-banner p-6">
        {errorMessage}
      </div>
    );
  }

  return (
    <section className="finance-chart-card">
      <h2 className="finance-chart-card-title">Event budgets</h2>
      {onEventClick ? (
        <p className="finance-chart-card-hint">Spent against planned budget</p>
      ) : null}

      {events.length === 0 ? (
        <p className="finance-meter-empty">No events in this period.</p>
      ) : (
        <ul
          data-testid="event-budget-list"
          className="finance-meter-list finance-meter-list--scroll"
        >
          {events.map((event) => {
            const usagePercent = budgetUsagePercent(
              event.planned_budget,
              event.actual_expense,
            );
            const interactive = Boolean(onEventClick);
            const over = event.over_budget;
            const unset = parseCurrencyAmount(event.planned_budget) <= 0;

            return (
              <li key={event.event_id}>
                <div
                  data-testid={`event-budget-row-${event.event_id}`}
                  className={[
                    "finance-meter-row",
                    interactive ? "is-interactive" : "",
                    over ? "is-over" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={
                    interactive
                      ? () => onEventClick?.(event.event_id)
                      : undefined
                  }
                  onKeyDown={
                    interactive
                      ? (keyboardEvent) => {
                          if (
                            keyboardEvent.key === "Enter" ||
                            keyboardEvent.key === " "
                          ) {
                            keyboardEvent.preventDefault();
                            onEventClick?.(event.event_id);
                          }
                        }
                      : undefined
                  }
                >
                  <div className="finance-meter-meta">
                    <span className="finance-meter-name">{event.event_name}</span>
                    <span className="finance-meter-value">
                      {formatBudgetSpentLabel(
                        event.actual_expense,
                        event.planned_budget,
                      )}
                    </span>
                  </div>
                  <div className="finance-meter-track-row">
                    <div className="finance-meter-track" aria-hidden="true">
                      <div
                        data-testid={`event-budget-bar-${event.event_id}`}
                        className={`finance-meter-fill ${budgetProgressBarClass(event)}`}
                        style={{ width: unset ? "0%" : `${usagePercent}%` }}
                      />
                    </div>
                    <span
                      className={[
                        "finance-meter-pct",
                        over ? "is-over" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {percentLabel(event)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
