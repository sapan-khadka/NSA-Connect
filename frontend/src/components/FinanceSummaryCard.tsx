import { TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

import type { FinanceSummaryResponse } from "../lib/finance-api";
import {
  currencyBalanceToneClass,
  formatCurrency,
  parseCurrencyAmount,
} from "../lib/format-currency";
import { DataTable } from "../design-system/components/data-display/DataTable";
import type { DataTableColumn } from "../design-system/components/data-display/DataTable";
import { AppIcon } from "./ui/AppIcon";
import { Card } from "./ui/Card";

type FinanceSummaryMetricsProps = {
  isLoading: boolean;
  errorMessage: string | null;
  summary: FinanceSummaryResponse | null;
  pendingCount?: number;
};

type FinanceTransactionBreakdownProps = {
  summary: FinanceSummaryResponse | null;
};

type BreakdownRow = {
  id: string;
  category: string;
  income: string;
  expense: string;
  balance: string;
  entryCount: number;
};

function buildBreakdownRows(summary: FinanceSummaryResponse): BreakdownRow[] {
  return [
    {
      id: "pre-event",
      category: "Pre-event / general",
      income: summary.pre_event.income,
      expense: summary.pre_event.expense,
      balance: summary.pre_event.balance,
      entryCount: summary.pre_event.entry_count,
    },
    ...summary.events.map((eventSummary) => ({
      id: String(eventSummary.event_id),
      category: eventSummary.event_name,
      income: eventSummary.income,
      expense: eventSummary.expense,
      balance: eventSummary.balance,
      entryCount: eventSummary.entry_count,
    })),
  ];
}

const breakdownColumns: DataTableColumn<BreakdownRow>[] = [
  {
    id: "category",
    header: "Category",
    cell: (row) => (
      <span className="font-medium text-foreground">{row.category}</span>
    ),
  },
  {
    id: "income",
    header: "Income",
    cell: (row) => (
      <span className="text-accent">{formatCurrency(row.income)}</span>
    ),
  },
  {
    id: "expense",
    header: "Expense",
    cell: (row) => <span>{formatCurrency(row.expense)}</span>,
  },
  {
    id: "balance",
    header: "Balance",
    cell: (row) => (
      <span className={`font-medium ${currencyBalanceToneClass(row.balance)}`}>
        {formatCurrency(row.balance)}
      </span>
    ),
  },
  {
    id: "entries",
    header: "Entries",
    cell: (row) => <span className="text-label">{row.entryCount}</span>,
  },
];

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
    <Card padding="md">
      <h2 className="text-base font-medium text-foreground">
        Transaction breakdown
      </h2>

      <div className="mt-6">
        <DataTable
          columns={breakdownColumns}
          rows={buildBreakdownRows(summary)}
          getRowId={(row) => row.id}
          emptyTitle="No finance entries yet for this period."
          emptyDescription=""
          caption="Finance transaction breakdown by category"
          className="border-0 bg-transparent shadow-none rounded-none"
        />
      </div>
    </Card>
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
