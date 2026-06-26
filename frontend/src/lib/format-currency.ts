export function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}

export function parseCurrencyAmount(amount: string): number {
  const value = Number.parseFloat(amount);
  return Number.isFinite(value) ? value : 0;
}

export function currencyBalanceToneClass(amount: string): string {
  const value = parseCurrencyAmount(amount);

  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-red-700";
  }

  return "text-primary";
}
