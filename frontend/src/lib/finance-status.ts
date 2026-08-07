/** Tone classes for finance change-request / collection states. */

export type FinanceReviewStatus = "pending" | "approved" | "rejected";

/** Distinct hues so Approved / Rejected / Pending never collapse to grey. */
export function financeReviewStatusToneClass(
  status: FinanceReviewStatus | string,
): string {
  if (status === "pending") {
    return "finance-status finance-status--pending";
  }
  if (status === "approved") {
    return "finance-status finance-status--approved";
  }
  return "finance-status finance-status--rejected";
}

export function financeEntryTypeToneClass(
  entryType: "income" | "expense" | string,
): string {
  if (entryType === "income") {
    return "finance-entry-type finance-entry-type--income";
  }
  return "finance-entry-type finance-entry-type--expense";
}
