import type { ChatFinanceSummary } from "./chat-stream";

const INCOME_OR_EXPENSE = /^\d+\.\d{2}$/;
const BALANCE = /^-?\d+\.\d{2}$/;

export function isTreasurySummary(value: unknown): value is ChatFinanceSummary {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const card = value as ChatFinanceSummary;
  if (card.currency !== "USD") {
    return false;
  }
  if (typeof card.period_label !== "string" || card.period_label.trim() === "") {
    return false;
  }
  if (
    !INCOME_OR_EXPENSE.test(card.total_income) ||
    !INCOME_OR_EXPENSE.test(card.total_expense) ||
    !BALANCE.test(card.balance)
  ) {
    return false;
  }
  if (!Array.isArray(card.breakdown)) {
    return false;
  }
  return card.breakdown.every(
    (line) =>
      line != null &&
      typeof line.label === "string" &&
      line.label.trim() !== "" &&
      INCOME_OR_EXPENSE.test(line.expense),
  );
}
