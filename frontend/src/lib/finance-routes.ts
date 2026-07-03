export type FinanceTab = "overview" | "transactions" | "approvals";

export const FINANCE_PATH = "/finance";
export const FINANCE_APPROVALS_PATH = "/finance?tab=approvals";
export const FINANCE_TRANSACTIONS_PATH = "/finance?tab=transactions";

export function parseFinanceTab(value: string | null): FinanceTab {
  if (value === "transactions" || value === "approvals") {
    return value;
  }

  return "overview";
}

export function financeTabSearchParams(
  tab: FinanceTab,
): Record<string, string> {
  if (tab === "overview") {
    return {};
  }

  return { tab };
}
