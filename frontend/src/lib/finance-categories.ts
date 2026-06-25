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

export function formatFinanceCategory(category: string): string {
  return FINANCE_CATEGORY_LABELS[category] ?? category.replaceAll("_", " ");
}
