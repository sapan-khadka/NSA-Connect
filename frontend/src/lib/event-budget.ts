import { formatCurrency, formatCurrencyCompact, parseCurrencyAmount } from "./format-currency";

export type EventBudgetRow = {
  event_id: number;
  event_name: string;
  planned_budget: string;
  actual_expense: string;
  actual_income: string;
  budget_remaining: string;
  over_budget: boolean;
  entry_count: number;
};

export function budgetUsagePercent(
  plannedBudget: string,
  actualExpense: string,
): number {
  const budget = parseCurrencyAmount(plannedBudget);
  const expense = parseCurrencyAmount(actualExpense);

  if (budget <= 0) {
    return expense > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((expense / budget) * 100));
}

export function budgetDisplayPercent(
  plannedBudget: string,
  actualExpense: string,
): number {
  const budget = parseCurrencyAmount(plannedBudget);
  const expense = parseCurrencyAmount(actualExpense);

  if (budget <= 0) {
    return expense > 0 ? 100 : 0;
  }

  return Math.round((expense / budget) * 100);
}

export function formatBudgetSpentLabel(
  actualExpense: string,
  plannedBudget: string,
): string {
  if (parseCurrencyAmount(plannedBudget) <= 0) {
    return "No budget set";
  }

  return `${formatCurrencyCompact(actualExpense)} of ${formatCurrencyCompact(plannedBudget)}`;
}

export function budgetStatusLabel(row: EventBudgetRow): string {
  if (row.over_budget) {
    return "Over budget";
  }

  if (parseCurrencyAmount(row.actual_expense) === 0) {
    return "No spending yet";
  }

  return "Under budget";
}

export function budgetStatusClass(row: EventBudgetRow): string {
  if (row.over_budget) {
    return "bg-urgent/30 text-foreground";
  }

  if (parseCurrencyAmount(row.actual_expense) === 0) {
    return "bg-surface-muted text-foreground";
  }

  return "bg-mint text-primary";
}

export function budgetProgressBarClass(row: EventBudgetRow): string {
  if (row.over_budget) {
    return "bg-urgent";
  }

  if (parseCurrencyAmount(row.actual_expense) === 0) {
    return "bg-gray-300";
  }

  return "bg-mint";
}

export function formatBudgetRemaining(amount: string): string {
  return formatCurrency(amount);
}
