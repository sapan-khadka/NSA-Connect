import {
  budgetProgressBarClass,
  budgetStatusClass,
  budgetStatusLabel,
  budgetUsagePercent,
  formatBudgetRemaining,
  type EventBudgetRow,
} from "../lib/event-budget";
import { formatCurrency } from "../lib/format-currency";

type EventBudgetBreakdownProps = {
  events: EventBudgetRow[];
  isLoading: boolean;
  errorMessage: string | null;
};

export function EventBudgetBreakdown({
  events,
  isLoading,
  errorMessage,
}: EventBudgetBreakdownProps) {
  if (isLoading) {
    return (
      <div className="rounded-card bg-surface-card p-10 text-center text-label">
        Loading event budget breakdown...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="ds-alert-banner p-6"
      >
        {errorMessage}
      </div>
    );
  }

  return (
    <section className="rounded-card bg-surface-card p-6">
      <div>
        <h2 className="text-lg font-light tracking-subhead text-foreground">
          Event budget vs actual
        </h2>
        <p className="mt-1 text-sm text-label">
          Compare each event&apos;s planned budget against logged spending.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table
          data-testid="event-budget-table"
          className="min-w-full divide-y divide-gray-200 text-left text-sm"
        >
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-label">
            <tr>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Planned budget</th>
              <th className="px-4 py-3 font-semibold">Actual expense</th>
              <th className="px-4 py-3 font-semibold">Actual income</th>
              <th className="px-4 py-3 font-semibold">Remaining</th>
              <th className="px-4 py-3 font-semibold">Usage</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((event) => {
              const usagePercent = budgetUsagePercent(
                event.planned_budget,
                event.actual_expense,
              );

              return (
                <tr key={event.event_id}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {event.event_name}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatCurrency(event.planned_budget)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatCurrency(event.actual_expense)}
                  </td>
                  <td className="px-4 py-3 text-accent">
                    {formatCurrency(event.actual_income)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      event.over_budget ? "text-foreground" : "text-accent"
                    }`}
                  >
                    {formatBudgetRemaining(event.budget_remaining)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-32 items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div
                          className={`h-2 rounded-full ${budgetProgressBarClass(event)}`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-label">
                        {usagePercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${budgetStatusClass(event)}`}
                    >
                      {budgetStatusLabel(event)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-label"
                >
                  No events found for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
