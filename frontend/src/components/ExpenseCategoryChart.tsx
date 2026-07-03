import { formatFinanceCategory } from "../lib/finance-categories";
import {
  formatCurrencyCompact,
  parseCurrencyAmount,
} from "../lib/format-currency";

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

const BAR_COLORS = [
  "bg-primary",
  "bg-accent",
  "bg-olive",
  "bg-gray-300",
  "bg-mint",
] as const;

function barWidth(totalExpense: string, categoryExpense: string): number {
  const total = parseCurrencyAmount(totalExpense);
  const amount = parseCurrencyAmount(categoryExpense);

  if (total <= 0 || amount <= 0) {
    return 0;
  }

  return Math.max(4, Math.round((amount / total) * 100));
}

function barColor(index: number): string {
  return BAR_COLORS[index % BAR_COLORS.length];
}

export function ExpenseCategoryChart({
  categories,
  totalExpense,
  isLoading,
  errorMessage,
}: ExpenseCategoryChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-200 bg-surface-card p-10 text-center text-label shadow-card">
        Loading expense categories...
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
        Spend by category
      </h2>

      {categories.length === 0 ? (
        <p className="mt-8 text-center text-sm text-label">
          No expenses logged for this period.
        </p>
      ) : (
        <div
          data-testid="expense-category-chart"
          className="mt-6 space-y-5"
          role="img"
          aria-label="Expense bar chart by category"
        >
          {categories.map((item, index) => {
            const width = barWidth(totalExpense, item.total_expense);

            return (
              <div key={item.category}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-[13px] font-light text-foreground">
                    {formatFinanceCategory(item.category)}
                  </span>
                  <span className="text-[13px] font-medium text-foreground">
                    {formatCurrencyCompact(item.total_expense)}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100">
                  <div
                    data-testid={`expense-bar-${item.category}`}
                    className={`h-2.5 rounded-full transition-all ${barColor(index)}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
