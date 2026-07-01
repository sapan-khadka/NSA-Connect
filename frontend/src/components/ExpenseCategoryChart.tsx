import { formatFinanceCategory } from "../lib/finance-categories";
import { formatCurrency, parseCurrencyAmount } from "../lib/format-currency";

export type ExpenseCategoryRow = {
  category: string;
  total_expense: string;
  entry_count: number;
};

type ExpenseCategoryChartProps = {
  categories: ExpenseCategoryRow[];
  totalExpense: string;
  isLoading: boolean;
  errorMessage: string | null;
};

function barWidth(totalExpense: string, categoryExpense: string): number {
  const total = parseCurrencyAmount(totalExpense);
  const amount = parseCurrencyAmount(categoryExpense);

  if (total <= 0 || amount <= 0) {
    return 0;
  }

  return Math.max(4, Math.round((amount / total) * 100));
}

export function ExpenseCategoryChart({
  categories,
  totalExpense,
  isLoading,
  errorMessage,
}: ExpenseCategoryChartProps) {
  if (isLoading) {
    return (
      <div className="ds-card p-10 text-center text-label">
        Loading expense categories...
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
    <section className="ds-card p-6">
      <div>
        <h2 className="text-lg font-light tracking-subhead text-foreground">Spend by category</h2>
        <p className="mt-1 text-sm text-label">
          Expense totals grouped by category for the selected semester.
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="mt-8 text-center text-sm text-label">
          No expenses logged for this period.
        </p>
      ) : (
        <div
          data-testid="expense-category-chart"
          className="mt-8 space-y-5"
          role="img"
          aria-label="Expense bar chart by category"
        >
          {categories.map((item) => {
            const width = barWidth(totalExpense, item.total_expense);

            return (
              <div key={item.category}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-foreground">
                    {formatFinanceCategory(item.category)}
                  </span>
                  <span className="text-foreground">
                    {formatCurrency(item.total_expense)}
                  </span>
                </div>
                <div className="h-4 rounded-full bg-gray-100">
                  <div
                    data-testid={`expense-bar-${item.category}`}
                    className="h-4 rounded-full bg-accent transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-label">
                  {item.entry_count} {item.entry_count === 1 ? "entry" : "entries"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
