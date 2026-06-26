import type { FinanceSummaryResponse } from "../lib/finance-api";
import {
  currencyBalanceToneClass,
  formatCurrency,
} from "../lib/format-currency";

type FinanceSummaryCardProps = {
  isLoading: boolean;
  errorMessage: string | null;
  summary: FinanceSummaryResponse | null;
};

type MetricCardProps = {
  title: string;
  amount: string;
  testId?: string;
  tone?: "default" | "income" | "expense" | "balance";
  subtitle?: string;
};

function MetricCard({
  title,
  amount,
  testId,
  tone = "default",
  subtitle,
}: MetricCardProps) {
  const sectionClass =
    tone === "income"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "expense"
        ? "border-red-200 bg-red-50"
        : "border-gray-200 bg-white";

  const titleClass =
    tone === "income"
      ? "text-emerald-800"
      : tone === "expense"
        ? "text-red-800"
        : "text-gray-500";

  const amountClass =
    tone === "income"
      ? "text-emerald-800"
      : tone === "expense"
        ? "text-red-800"
        : tone === "balance"
          ? currencyBalanceToneClass(amount)
          : "text-primary";

  return (
    <section className={`rounded-lg border p-6 xl:col-span-1 ${sectionClass}`}>
      <h2 className={`text-sm font-semibold uppercase tracking-wide ${titleClass}`}>
        {title}
      </h2>
      <p
        data-testid={testId}
        className={`mt-3 text-4xl font-bold ${amountClass}`}
      >
        {formatCurrency(amount)}
      </p>
      {subtitle ? <p className="mt-2 text-sm text-gray-500">{subtitle}</p> : null}
    </section>
  );
}

export function FinanceSummaryCard({
  isLoading,
  errorMessage,
  summary,
}: FinanceSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
        Loading finance summary...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800"
      >
        {errorMessage}
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Running balance"
          amount={summary.balance}
          testId="finance-running-balance"
          tone="balance"
          subtitle="Net position across logged entries"
        />
        <MetricCard
          title="Total income"
          amount={summary.total_income}
          testId="finance-total-income"
          tone="income"
        />
        <MetricCard
          title="Total expense"
          amount={summary.total_expense}
          testId="finance-total-expense"
          tone="expense"
        />
        <MetricCard
          title="Net balance"
          amount={summary.balance}
          testId="finance-net-balance"
          tone="balance"
          subtitle="Income minus expenses"
        />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              Transaction breakdown
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {summary.entry_count} entries in this view
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Income</th>
                <th className="px-4 py-3 font-semibold">Expense</th>
                <th className="px-4 py-3 font-semibold">Balance</th>
                <th className="px-4 py-3 font-semibold">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-3 font-medium text-primary">
                  Pre-event / general
                </td>
                <td className="px-4 py-3 text-emerald-700">
                  {formatCurrency(summary.pre_event.income)}
                </td>
                <td className="px-4 py-3 text-red-700">
                  {formatCurrency(summary.pre_event.expense)}
                </td>
                <td
                  className={`px-4 py-3 font-medium ${currencyBalanceToneClass(summary.pre_event.balance)}`}
                >
                  {formatCurrency(summary.pre_event.balance)}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {summary.pre_event.entry_count}
                </td>
              </tr>
              {summary.events.map((eventSummary) => (
                <tr key={eventSummary.event_id}>
                  <td className="px-4 py-3 font-medium text-primary">
                    {eventSummary.event_name}
                  </td>
                  <td className="px-4 py-3 text-emerald-700">
                    {formatCurrency(eventSummary.income)}
                  </td>
                  <td className="px-4 py-3 text-red-700">
                    {formatCurrency(eventSummary.expense)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${currencyBalanceToneClass(eventSummary.balance)}`}
                  >
                    {formatCurrency(eventSummary.balance)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {eventSummary.entry_count}
                  </td>
                </tr>
              ))}
              {summary.events.length === 0 &&
                summary.pre_event.entry_count === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No finance entries yet for this period.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
