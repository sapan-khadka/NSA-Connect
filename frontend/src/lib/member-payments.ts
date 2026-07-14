/**
 * Member dues / payment presentation helpers.
 * Outstanding and status rules mirror backend MemberDues.compute_status
 * and dues dashboard outstanding aggregation — UI shows badges, progress,
 * and timeline instead of raw numbers alone.
 */

import { duesStatusLabel } from "./dues";
import type { DuesPaymentMethod, DuesStatus } from "./dues-api";
import { parseCurrencyAmount } from "./format-currency";
import { formatSemesterLabel, getCurrentSemesterSlug } from "./semester";

export type MemberPaymentRecord = {
  id: number;
  semester: string;
  amountOwed: string;
  amountPaid: string;
  status: DuesStatus;
  paidAt: string | null;
  paymentMethod: DuesPaymentMethod | null;
  note: string | null;
  /** ISO date; when omitted and still outstanding, semester convention applies. */
  dueDate?: string | null;
};

export type MemberPaymentsSummary = {
  currentSemester: string;
  currentBalance: number;
  outstandingAmount: number;
  paymentStatus: DuesStatus | null;
  paymentStatusLabel: string;
  /** 0–100 fill for current-semester progress (paid / owed). */
  progressPercent: number;
  nextDueDate: string | null;
  nextDueLabel: string;
  history: MemberPaymentRecord[];
  hasRecords: boolean;
};

/**
 * Same rule as backend dues dashboard:
 * max(amount_owed - amount_paid, 0).
 */
export function outstandingFromAmounts(
  amountOwed: string | number,
  amountPaid: string | number,
): number {
  const owed = parseCurrencyAmount(String(amountOwed));
  const paid = parseCurrencyAmount(String(amountPaid));
  return Math.max(owed - paid, 0);
}

/**
 * Mirrors backend MemberDues.compute_status.
 */
export function computeDuesStatus(
  amountOwed: string | number,
  amountPaid: string | number,
): DuesStatus {
  const owed = parseCurrencyAmount(String(amountOwed));
  const paid = parseCurrencyAmount(String(amountPaid));
  if (owed <= 0) {
    return "exempt";
  }
  if (paid >= owed) {
    return "paid";
  }
  if (paid > 0) {
    return "partial";
  }
  return "unpaid";
}

/**
 * Progress toward clearing the current balance: paid / owed.
 * Exempt and zero-owed → 100. Unpaid with zero paid → 0.
 */
export function paymentProgressPercent(
  amountOwed: string | number,
  amountPaid: string | number,
  status?: DuesStatus | null,
): number {
  const resolved =
    status ?? computeDuesStatus(amountOwed, amountPaid);
  if (resolved === "exempt") {
    return 100;
  }
  const owed = parseCurrencyAmount(String(amountOwed));
  if (owed <= 0) {
    return 100;
  }
  const paid = parseCurrencyAmount(String(amountPaid));
  return Math.min(100, Math.round((paid / owed) * 100));
}

/**
 * Conventional dues due date from semester slug when the API has no due_date.
 * Spring → Feb 15, Summer → Jun 15, Fall → Sep 15 of that year.
 */
export function semesterDuesDueDate(
  semesterSlug: string,
): string | null {
  const [yearStr, term] = semesterSlug.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  if (!Number.isFinite(year) || !term) {
    return null;
  }

  const monthDay =
    term === "spring"
      ? "02-15"
      : term === "summer"
        ? "06-15"
        : term === "fall"
          ? "09-15"
          : null;
  if (!monthDay) {
    return null;
  }
  return `${year}-${monthDay}`;
}

function formatDueDateLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function computeMemberPaymentsSummary(
  records: MemberPaymentRecord[],
  currentSemester = getCurrentSemesterSlug(),
): MemberPaymentsSummary {
  const sorted = [...records].sort((a, b) => {
    const aTime = a.paidAt
      ? new Date(a.paidAt).getTime()
      : semesterSortKey(a.semester);
    const bTime = b.paidAt
      ? new Date(b.paidAt).getTime()
      : semesterSortKey(b.semester);
    return bTime - aTime;
  });

  const current =
    records.find((r) => r.semester === currentSemester) ?? null;

  const outstandingAmount = records.reduce(
    (sum, record) =>
      sum + outstandingFromAmounts(record.amountOwed, record.amountPaid),
    0,
  );

  const currentBalance = current
    ? outstandingFromAmounts(current.amountOwed, current.amountPaid)
    : outstandingAmount;

  const paymentStatus = current?.status ?? null;

  let nextDueDate: string | null = null;
  if (
    current &&
    (current.status === "unpaid" || current.status === "partial")
  ) {
    nextDueDate =
      current.dueDate ?? semesterDuesDueDate(current.semester);
  } else if (!current && outstandingAmount > 0) {
    const open = sorted.find(
      (r) => r.status === "unpaid" || r.status === "partial",
    );
    if (open) {
      nextDueDate = open.dueDate ?? semesterDuesDueDate(open.semester);
    }
  }

  return {
    currentSemester,
    currentBalance,
    outstandingAmount,
    paymentStatus,
    paymentStatusLabel: paymentStatus
      ? duesStatusLabel(paymentStatus)
      : records.length === 0
        ? "No record"
        : "See history",
    progressPercent: current
      ? paymentProgressPercent(
          current.amountOwed,
          current.amountPaid,
          current.status,
        )
      : outstandingAmount > 0
        ? 0
        : records.length > 0
          ? 100
          : 0,
    nextDueDate,
    nextDueLabel: nextDueDate
      ? formatDueDateLabel(nextDueDate)
      : paymentStatus === "paid" || paymentStatus === "exempt"
        ? "None"
        : "—",
    history: sorted,
    hasRecords: records.length > 0,
  };
}

function semesterSortKey(slug: string): number {
  const [yearStr, term] = slug.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  if (!Number.isFinite(year)) {
    return 0;
  }
  const termWeight =
    term === "spring" ? 1 : term === "summer" ? 2 : term === "fall" ? 3 : 0;
  return year * 10 + termWeight;
}

export function paymentHistoryTitle(record: MemberPaymentRecord): string {
  return formatSemesterLabel(record.semester);
}
