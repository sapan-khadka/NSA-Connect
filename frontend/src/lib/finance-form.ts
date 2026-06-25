export const FINANCE_ENTRY_TYPES = ["income", "expense"] as const;

export type FinanceEntryType = (typeof FINANCE_ENTRY_TYPES)[number];

export const FINANCE_CATEGORIES = [
  "membership_dues",
  "fundraising",
  "donation",
  "sponsorship",
  "food_beverage",
  "venue",
  "supplies",
  "marketing",
  "travel",
  "event",
  "other",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export type LogFinanceEntryFormValues = {
  entry_type: FinanceEntryType;
  category: FinanceCategory;
  amount: string;
  description: string;
  event_id: string;
};

export type LogFinanceEntryFormErrors = Partial<
  Record<keyof LogFinanceEntryFormValues, string>
>;

export const initialLogFinanceEntryValues: LogFinanceEntryFormValues = {
  entry_type: "expense",
  category: "food_beverage",
  amount: "",
  description: "",
  event_id: "",
};

export function formatAmountForSubmit(amount: string): string {
  return Number.parseFloat(amount).toFixed(2);
}

export function validateLogFinanceEntryForm(
  values: LogFinanceEntryFormValues,
): LogFinanceEntryFormErrors {
  const errors: LogFinanceEntryFormErrors = {};

  if (!values.amount.trim()) {
    errors.amount = "Amount is required";
  } else {
    const amount = Number.parseFloat(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Enter a valid amount greater than zero";
    } else if (!/^\d+(\.\d{1,2})?$/.test(values.amount.trim())) {
      errors.amount = "Use at most two decimal places";
    }
  }

  return errors;
}
