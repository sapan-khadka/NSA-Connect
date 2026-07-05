export type FinanceTab = "overview" | "transactions" | "approvals" | "dues";

export const FINANCE_PATH = "/finance";
export const FINANCE_APPROVALS_PATH = "/finance?tab=approvals";
export const FINANCE_TRANSACTIONS_PATH = "/finance?tab=transactions";
export const FINANCE_DUES_PATH = "/finance?tab=dues";

export function parseFinanceTab(value: string | null): FinanceTab {
  if (
    value === "transactions" ||
    value === "approvals" ||
    value === "dues"
  ) {
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
