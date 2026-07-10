/**
 * Shared field chrome for Input, Textarea, and Select.
 * Matches `.ds-field-input` so gradual className migrations stay visually identical.
 */
export const fieldControlClassName =
  "w-full rounded-lg border border-gray-200 bg-surface-card px-3 py-3 text-base text-foreground shadow-none transition duration-200 placeholder:text-label focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 sm:py-2 sm:text-sm";

export const fieldControlErrorClassName =
  "border-overdue focus:border-overdue focus:ring-overdue/20";

export const fieldLabelClassName =
  "block text-sm font-medium text-foreground";

export const fieldHintClassName = "mt-1 text-sm text-label";

export const fieldErrorClassName = "mt-1 text-sm text-overdue";
