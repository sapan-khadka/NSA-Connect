import { TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

import type { FinanceSummaryResponse } from "../lib/finance-api";
import {
  currencyBalanceToneClass,
  formatCurrency,
  parseCurrencyAmount,
} from "../lib/format-currency";
import { AppIcon } from "./ui/AppIcon";

type FinanceSummaryMetricsProps = {
  isLoading: boolean;
  errorMessage: string | null;
  summary: FinanceSummaryResponse | null;
  pendingCount?: number;
};

type FinanceTransactionBreakdownProps = {
  summary: FinanceSummaryResponse | null;
};

type MetricCardProps = {
  title: string;
  children: ReactNode;
  testId?: string;
  variant?: "neutral" | "positive" | "negative";
  caption?: string | null;
};

function netBalanceCaption(summary: FinanceSummaryResponse): string | null {
  const balance = parseCurrencyAmount(summary.balance);
  const income = parseCurrencyAmount(summary.total_income);
  const expense = parseCurrencyAmount(summary.total_expense);

  if (balance < 0 && income === 0 && expense > 0) {
    return "Spending with no income yet";
  }

  if (balance < 0) {
    return "Expenses exceed income";
  }

  if (balance > 0 && expense > income) {
    return null;
  }

  return null;
}

function netBalanceVariant(amount: string): "neutral" | "positive" | "negative" {
  const value = parseCurrencyAmount(amount);

  if (value < 0) {
    return "negative";
  }

  if (value > 0) {
    return "positive";
  }

  return "neutral";
}

function metricCardClasses(variant: "neutral" | "positive" | "negative"): string {
  if (variant === "negative") {
    return "border border-overdue/20 bg-overdue-surface";
  }

  if (variant === "positive") {
    return "border border-accent/20 bg-mint/25";
  }

  return "border border-gray-200 bg-surface-card";
}

function MetricCard({
  title,
  children,
  testId,
  variant = "neutral",
  caption,
}: MetricCardProps) {
  return (
    <section
      data-testid={testId}
      className={`rounded-card p-5 shadow-card ${metricCardClasses(variant)}`}
    >
      <div className="ds-icon-label">
        {variant === "negative" ? (
          <AppIcon icon={TrendingDown} size="sm" className="text-overdue" />
        ) : null}
        <h2 className="text-xs font-medium uppercase tracking-label text-label">
          {title}
        </h2>
      </div>
      <div className="mt-3">{children}</div>
      {caption ? (
        <p className="mt-2 text-xs font-light text-overdue">{caption}</p>
      ) : null}
    </section>
  );
}

export function FinanceSummaryMetrics({
  isLoading,
  errorMessage,
  summary,
  pendingCount = 0,
}: FinanceSummaryMetricsProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-gray-200 bg-surface-card p-10 text-center text-label shadow-card">
        Loading finance summary...
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

  if (!summary) {
    return null;
  }

  const balanceVariant = netBalanceVariant(summary.balance);
  const balanceAmountClass =
    balanceVariant === "negative"
      ? "text-overdue"
      : balanceVariant === "positive"
        ? "text-accent"
        : "text-foreground";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Net balance"
        testId="finance-net-balance"
        variant={balanceVariant}
        caption={balanceVariant === "negative" ? netBalanceCaption(summary) : null}
      >
        <p
          data-testid="finance-net-balance-amount"
          className={`text-3xl font-light tracking-headline ${balanceAmountClass}`}
        >
          {formatCurrency(summary.balance)}
        </p>
      </MetricCard>

      <MetricCard title="Income" testId="finance-total-income">
        <p
          data-testid="finance-total-income-amount"
          className="text-3xl font-light tracking-headline text-foreground"
        >
          {formatCurrency(summary.total_income)}
        </p>
      </MetricCard>

      <MetricCard title="Expenses" testId="finance-total-expense">
        <p
          data-testid="finance-total-expense-amount"
          className="text-3xl font-light tracking-headline text-foreground"
        >
          {formatCurrency(summary.total_expense)}
        </p>
      </MetricCard>

      <MetricCard title="Pending" testId="finance-pending-count">
        <p className="text-3xl font-light tracking-headline text-foreground">
          <span>{pendingCount}</span>{" "}
          <span className="text-sm font-light text-label">
            {pendingCount === 1 ? "request" : "requests"}
          </span>
        </p>
      </MetricCard>
    </div>
  );
}

export function FinanceTransactionBreakdown({
  summary,
}: FinanceTransactionBreakdownProps) {
  if (!summary) {
    return null;
  }

  return (
    <section className="ds-card p-6">
      <h2 className="text-base font-medium text-foreground">
        Transaction breakdown
      </h2>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-label">
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
              <td className="px-4 py-3 font-medium text-foreground">
                Pre-event / general
              </td>
              <td className="px-4 py-3 text-accent">
                {formatCurrency(summary.pre_event.income)}
              </td>
              <td className="px-4 py-3 text-foreground">
                {formatCurrency(summary.pre_event.expense)}
              </td>
              <td
                className={`px-4 py-3 font-medium ${currencyBalanceToneClass(summary.pre_event.balance)}`}
              >
                {formatCurrency(summary.pre_event.balance)}
              </td>
              <td className="px-4 py-3 text-label">
                {summary.pre_event.entry_count}
              </td>
            </tr>
            {summary.events.map((eventSummary) => (
              <tr key={eventSummary.event_id}>
                <td className="px-4 py-3 font-medium text-foreground">
                  {eventSummary.event_name}
                </td>
                <td className="px-4 py-3 text-accent">
                  {formatCurrency(eventSummary.income)}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {formatCurrency(eventSummary.expense)}
                </td>
                <td
                  className={`px-4 py-3 font-medium ${currencyBalanceToneClass(eventSummary.balance)}`}
                >
                  {formatCurrency(eventSummary.balance)}
                </td>
                <td className="px-4 py-3 text-label">
                  {eventSummary.entry_count}
                </td>
              </tr>
            ))}
            {summary.events.length === 0 && summary.pre_event.entry_count === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-label">
                  No finance entries yet for this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** @deprecated Prefer FinanceSummaryMetrics and FinanceTransactionBreakdown */
export function FinanceSummaryCard({
  isLoading,
  errorMessage,
  summary,
  pendingCount,
}: FinanceSummaryMetricsProps) {
  return (
    <>
      <FinanceSummaryMetrics
        isLoading={isLoading}
        errorMessage={errorMessage}
        summary={summary}
        pendingCount={pendingCount}
      />
      <FinanceTransactionBreakdown summary={summary} />
    </>
  );
}
