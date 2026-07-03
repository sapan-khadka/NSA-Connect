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
};

function percentPillClass(event: EventBudgetRow): string {
  if (parseCurrencyAmount(event.planned_budget) <= 0) {
    return "bg-gray-100 text-label";
  }

  if (event.over_budget) {
    return "bg-overdue-surface text-overdue";
  }

  if (parseCurrencyAmount(event.actual_expense) === 0) {
    return "bg-gray-100 text-label";
  }

  return "bg-mint/40 text-primary";
}

function percentPillLabel(event: EventBudgetRow): string {
  if (parseCurrencyAmount(event.planned_budget) <= 0) {
    return "—";
  }

  return `${budgetDisplayPercent(event.planned_budget, event.actual_expense)}%`;
}

export function EventBudgetBreakdown({
  events,
  isLoading,
  errorMessage,
}: EventBudgetBreakdownProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-200 bg-surface-card p-10 text-center text-label shadow-card">
        Loading event budget breakdown...
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
    <section className="rounded-card border border-gray-200 bg-surface-card p-6 shadow-card">
      <h2 className="text-base font-medium text-foreground">
        Event budgets
      </h2>

      <div
        data-testid="event-budget-list"
        className="mt-6 space-y-6"
      >
        {events.map((event) => {
          const usagePercent = budgetUsagePercent(
            event.planned_budget,
            event.actual_expense,
          );

          return (
            <div
              key={event.event_id}
              data-testid={`event-budget-row-${event.event_id}`}
              className="flex items-start gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{event.event_name}</p>
                <p className="mt-0.5 text-[11px] font-light text-label">
                  {formatBudgetSpentLabel(
                    event.actual_expense,
                    event.planned_budget,
                  )}
                </p>
                <div className="mt-3 h-2 rounded-full bg-gray-100">
                  <div
                    data-testid={`event-budget-bar-${event.event_id}`}
                    className={`h-2 rounded-full ${budgetProgressBarClass(event)}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
              <span
                className={`mt-0.5 inline-flex min-w-10 shrink-0 items-center justify-center rounded-pill px-2.5 py-1 text-[11px] font-medium ${percentPillClass(event)}`}
              >
                {percentPillLabel(event)}
              </span>
            </div>
          );
        })}

        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-label">
            No events found for this period.
          </p>
        ) : null}
      </div>
    </section>
  );
}
