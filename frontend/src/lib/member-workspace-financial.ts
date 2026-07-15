/**
 * Member Workspace — Financial Status helpers from dues history.
 */

import type { DuesStatus, MemberDuesHistoryItem } from "./dues-api";
import { formatCurrency } from "./format-currency";
import { outstandingFromAmounts } from "./member-payments";

export type FinancialCurrentDuesTone = "paid" | "outstanding" | "exempt" | "neutral";

export type FinancialStatusSummary = {
  hasHistory: boolean;
  currentSemester: string;
  currentStatus: DuesStatus | null;
  currentStatusLabel: string;
  currentTone: FinancialCurrentDuesTone;
  outstandingAmount: number | null;
  outstandingLabel: string | null;
  lifetimeContributions: number | null;
  lifetimeLabel: string | null;
};

const STATUS_LABELS: Record<DuesStatus, string> = {
  paid: "Paid",
  unpaid: "Outstanding",
  partial: "Partial",
  exempt: "Exempt",
};

export function sumLifetimeContributions(
  records: MemberDuesHistoryItem[],
): number {
  return records.reduce(
    (sum, row) => sum + (Number.parseFloat(row.amount_paid) || 0),
    0,
  );
}

export function buildFinancialStatusSummary(input: {
  records: MemberDuesHistoryItem[];
  currentSemester: string;
}): FinancialStatusSummary {
  const { records, currentSemester } = input;
  if (records.length === 0) {
    return {
      hasHistory: false,
      currentSemester,
      currentStatus: null,
      currentStatusLabel: "No dues on record",
      currentTone: "neutral",
      outstandingAmount: null,
      outstandingLabel: null,
      lifetimeContributions: null,
      lifetimeLabel: null,
    };
  }

  const current =
    records.find((row) => row.semester === currentSemester) ?? null;
  const lifetime = sumLifetimeContributions(records);

  if (!current) {
    return {
      hasHistory: true,
      currentSemester,
      currentStatus: null,
      currentStatusLabel: "No dues this semester",
      currentTone: "neutral",
      outstandingAmount: null,
      outstandingLabel: null,
      lifetimeContributions: lifetime,
      lifetimeLabel: formatCurrency(lifetime),
    };
  }

  const outstanding = outstandingFromAmounts(
    current.amount_owed,
    current.amount_paid,
  );

  if (current.status === "paid") {
    return {
      hasHistory: true,
      currentSemester,
      currentStatus: current.status,
      currentStatusLabel: "Paid",
      currentTone: "paid",
      outstandingAmount: 0,
      outstandingLabel: null,
      lifetimeContributions: lifetime,
      lifetimeLabel: formatCurrency(lifetime),
    };
  }

  if (current.status === "exempt") {
    return {
      hasHistory: true,
      currentSemester,
      currentStatus: current.status,
      currentStatusLabel: "Exempt",
      currentTone: "exempt",
      outstandingAmount: 0,
      outstandingLabel: null,
      lifetimeContributions: lifetime,
      lifetimeLabel: formatCurrency(lifetime),
    };
  }

  return {
    hasHistory: true,
    currentSemester,
    currentStatus: current.status,
    currentStatusLabel: STATUS_LABELS[current.status],
    currentTone: "outstanding",
    outstandingAmount: outstanding,
    outstandingLabel:
      outstanding > 0 ? `Outstanding: ${formatCurrency(outstanding)}` : null,
    lifetimeContributions: lifetime,
    lifetimeLabel: formatCurrency(lifetime),
  };
}
