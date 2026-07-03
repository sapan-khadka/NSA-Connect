export function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCurrencyCompact(amount: string | number): string {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  const finite = Number.isFinite(value) ? value : 0;
  const hasCents = Math.abs(finite % 1) >= 0.005;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(finite);
}

export function parseCurrencyAmount(amount: string): number {
  const value = Number.parseFloat(amount);
  return Number.isFinite(value) ? value : 0;
}

export function currencyBalanceToneClass(amount: string): string {
  const value = parseCurrencyAmount(amount);

  if (value > 0) {
    return "text-accent";
  }

  if (value < 0) {
    return "text-foreground";
  }

  return "text-label";
}
