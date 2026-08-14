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
    return "text-overdue";
  }

  if (parseCurrencyAmount(row.actual_expense) === 0) {
    return "text-label";
  }

  return "text-foreground";
}

export function budgetProgressBarClass(row: EventBudgetRow): string {
  if (row.over_budget) {
    return "is-over bg-[#b91c1c]";
  }

  if (parseCurrencyAmount(row.actual_expense) === 0) {
    return "is-empty bg-[#d4d4d4]";
  }

  return "is-used bg-[#171717]";
}

export function formatBudgetRemaining(amount: string): string {
  return formatCurrency(amount);
}
