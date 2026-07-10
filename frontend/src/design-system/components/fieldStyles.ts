/**
 * Shared field chrome for Input, Textarea, and Select.
 * Uses CampusOS semantic tokens via Tailwind theme mappings.
 */
export const fieldControlClassName =
  "w-full rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm text-foreground shadow-none transition duration-200 placeholder:text-label focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60";

export const fieldControlErrorClassName =
  "border-overdue focus:border-overdue focus:ring-overdue/20";

export const fieldLabelClassName =
  "block text-sm font-medium text-foreground";

export const fieldHintClassName = "mt-1 text-sm text-label";

export const fieldErrorClassName = "mt-1 text-sm text-overdue";
