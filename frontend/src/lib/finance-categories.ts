export const FINANCE_CATEGORY_LABELS: Record<string, string> = {
  membership_dues: "Membership dues",
  fundraising: "Fundraising",
  donation: "Donation",
  sponsorship: "Sponsorship",
  food_beverage: "Food & beverage",
  venue: "Venue",
  supplies: "Supplies",
  marketing: "Marketing",
  travel: "Travel",
  event: "Event",
  other: "Other",
};

export const CUSTOM_FINANCE_CATEGORY = "__custom__" as const;

export type CustomFinanceCategorySentinel = typeof CUSTOM_FINANCE_CATEGORY;

function titleCaseFromSlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatFinanceCategory(category: string): string {
  return FINANCE_CATEGORY_LABELS[category] ?? titleCaseFromSlug(category);
}

export function isPresetFinanceCategory(
  category: string,
): category is keyof typeof FINANCE_CATEGORY_LABELS {
  return category in FINANCE_CATEGORY_LABELS;
}

export function normalizeCustomFinanceCategory(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return normalized;
}

export function resolveFinanceCategoryForSubmit(
  category: string,
  customCategory: string,
): string {
  if (category === CUSTOM_FINANCE_CATEGORY) {
    return normalizeCustomFinanceCategory(customCategory);
  }

  return category;
}

export function financeCategoryToFormValue(category: string): {
  category: string;
  customCategory: string;
} {
  if (isPresetFinanceCategory(category)) {
    return { category, customCategory: "" };
  }

  return {
    category: CUSTOM_FINANCE_CATEGORY,
    customCategory: formatFinanceCategory(category),
  };
}

export function validateCustomFinanceCategory(value: string): string | null {
  const normalized = normalizeCustomFinanceCategory(value);

  if (!normalized) {
    return "Enter a category name";
  }

  if (normalized.length < 2) {
    return "Category must be at least 2 characters";
  }

  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return "Use letters and numbers only";
  }

  return null;
}
