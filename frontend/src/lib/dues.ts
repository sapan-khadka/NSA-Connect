import { formatCurrency } from "./format-currency";
import { formatSemesterLabel } from "./semester";
import type { DuesPaymentMethod, DuesStatus, MyDuesStatusResponse } from "./dues-api";

export const DUES_PAYMENT_METHODS: { value: DuesPaymentMethod; label: string }[] = [
  { value: "venmo", label: "Venmo" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export const DUES_STATUS_FILTERS: { value: "all" | DuesStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "exempt", label: "Exempt" },
];

export function duesStatusLabel(status: DuesStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "unpaid":
      return "Unpaid";
    case "partial":
      return "Partial";
    case "exempt":
      return "Exempt";
  }
}

export function duesStatusToneClass(status: DuesStatus): string {
  switch (status) {
    case "paid":
      return "border-accent/30 bg-mint/20 text-accent";
    case "unpaid":
      return "border-overdue/30 bg-overdue-surface text-overdue";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "exempt":
      return "border-gray-200 bg-gray-50 text-label";
  }
}

export function formatMyDuesStatus(
  status: MyDuesStatusResponse,
): string | null {
  if (!status.has_record || !status.status) {
    return null;
  }

  const semesterLabel = formatSemesterLabel(status.semester);

  if (status.status === "paid") {
    return `Dues: Paid for ${semesterLabel}`;
  }

  if (status.status === "exempt") {
    return `Dues: Exempt for ${semesterLabel}`;
  }

  const owed = status.amount_owed ? formatCurrency(status.amount_owed) : null;
  if (status.status === "partial" && owed) {
    const paid = status.amount_paid ? formatCurrency(status.amount_paid) : "$0.00";
    return `Dues: ${paid} of ${owed} paid for ${semesterLabel}`;
  }

  if (owed) {
    return `Dues: ${owed} outstanding for ${semesterLabel}`;
  }

  return `Dues: Outstanding for ${semesterLabel}`;
}

export function paymentMethodLabel(method: DuesPaymentMethod | null): string {
  if (!method) {
    return "—";
  }

  const match = DUES_PAYMENT_METHODS.find((item) => item.value === method);
  if (match) {
    return match.label;
  }

  if (method === "online") {
    return "Online";
  }

  return method;
}
