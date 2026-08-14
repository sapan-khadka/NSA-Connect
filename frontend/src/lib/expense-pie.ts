import { formatFinanceCategory } from "./finance-categories";
import { parseCurrencyAmount } from "./format-currency";

export type ExpensePieInput = {
  category: string;
  total_expense: string;
  entry_count: number;
};

export type ExpensePieSlice = {
  key: string;
  label: string;
  amount: number;
  percent: number;
  color: string;
  startAngle: number;
  endAngle: number;
};

/** Bright, distinct slices that still read on a white canvas. */
export const EXPENSE_PIE_COLORS = [
  "#2563eb",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#f43f5e",
  "#22c55e",
  "#06b6d4",
] as const;

export function buildExpensePieSlices(
  categories: ExpensePieInput[],
  totalExpense: string,
): ExpensePieSlice[] {
  const total = parseCurrencyAmount(totalExpense);
  const ranked = categories
    .map((item) => ({
      key: item.category,
      label: formatFinanceCategory(item.category),
      amount: parseCurrencyAmount(item.total_expense),
    }))
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount);

  if (ranked.length === 0 || total <= 0) {
    return [];
  }

  let cursor = 0;
  return ranked.map((item, index) => {
    const share = item.amount / total;
    const sweep = share * 360;
    const startAngle = cursor;
    const endAngle = index === ranked.length - 1 ? 360 : cursor + sweep;
    cursor = endAngle;

    return {
      key: item.key,
      label: item.label,
      amount: item.amount,
      percent: Math.round(share * 100),
      color: EXPENSE_PIE_COLORS[index % EXPENSE_PIE_COLORS.length],
      startAngle,
      endAngle,
    };
  });
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

export function pieSlicePath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    return [
      `M ${cx} ${cy - radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
      "Z",
    ].join(" ");
  }

  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}
