import {
  formatBudgetRemaining,
} from "../lib/event-budget";
import { EVENT_MANAGE_ACTION_LINK } from "../lib/event-manage-ui";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import {
  formatCurrency,
  parseCurrencyAmount,
} from "../lib/format-currency";

type EventManageBudgetCardProps = {
  budget: FinanceEventBudgetSummary | null;
  canViewTreasury: boolean;
  onViewTransactions: () => void;
};

export function EventManageBudgetCard({
  budget,
  canViewTreasury,
  onViewTransactions,
}: EventManageBudgetCardProps) {
  if (!budget) {
    return (
      <section id="event-manage-budget" aria-label="Budget">
        <div className="event-command-section-head">
          <h2 className="event-command-kicker">Budget</h2>
        </div>
        <p className="event-command-stat">
          Planned budget and spend will appear here when finance data is ready.
        </p>
      </section>
    );
  }

  const spent = parseCurrencyAmount(budget.actual_expense);
  const income = parseCurrencyAmount(budget.actual_income);
  const netBalance = income - spent;

  return (
    <section id="event-manage-budget" aria-label="Budget">
      <div className="event-command-section-head">
        <h2 className="event-command-kicker">Budget</h2>
        {canViewTreasury ? (
          <button
            type="button"
            onClick={onViewTransactions}
            className={EVENT_MANAGE_ACTION_LINK}
          >
            View transactions
          </button>
        ) : null}
      </div>
      <dl className="event-command-facts">
        <div>
          <dt>Planned</dt>
          <dd>{formatCurrency(budget.planned_budget)}</dd>
        </div>
        <div>
          <dt>Spent</dt>
          <dd>{formatCurrency(budget.actual_expense)}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{formatBudgetRemaining(budget.budget_remaining)}</dd>
        </div>
        <div>
          <dt>Net</dt>
          <dd>{formatCurrency(netBalance)}</dd>
        </div>
      </dl>
    </section>
  );
}
