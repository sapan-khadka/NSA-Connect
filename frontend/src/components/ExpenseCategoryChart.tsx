import { useMemo, useState } from "react";

import {
  buildExpensePieSlices,
  pieSlicePath,
  type ExpensePieSlice,
} from "../lib/expense-pie";
import { formatCurrencyCompact } from "../lib/format-currency";

export type ExpenseCategoryRow = {
  category: string;
  total_expense: string;
  entry_count: number;
};

type ExpenseCategoryChartProps = {
  categories: ExpenseCategoryRow[];
  totalExpense: string;
  isLoading: boolean;
  errorMessage: string | null;
};

const PIE_SIZE = 196;
const PIE_RADIUS = 84;

function PieChart({
  slices,
  selectedKey,
  onSelect,
  totalLabel,
}: {
  slices: ExpensePieSlice[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  totalLabel: string;
}) {
  const selected = slices.find((slice) => slice.key === selectedKey) ?? null;
  const cx = PIE_SIZE / 2;
  const cy = PIE_SIZE / 2;

  return (
    <div className="finance-pie">
      <svg
        className="finance-pie__canvas"
        width={PIE_SIZE}
        height={PIE_SIZE}
        viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}
        role="img"
        aria-label="Spend by category pie chart"
      >
        {slices.map((slice) => {
          const active = selectedKey === null || selectedKey === slice.key;
          return (
            <path
              key={slice.key}
              data-testid={`expense-slice-${slice.key}`}
              d={pieSlicePath(
                cx,
                cy,
                PIE_RADIUS,
                slice.startAngle,
                slice.endAngle,
              )}
              fill={slice.color}
              opacity={active ? 1 : 0.28}
              role="button"
              tabIndex={0}
              aria-label={`${slice.label}, ${formatCurrencyCompact(slice.amount)}, ${slice.percent}%`}
              aria-pressed={selectedKey === slice.key}
              className="finance-pie__slice"
              onClick={() =>
                onSelect(selectedKey === slice.key ? null : slice.key)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(selectedKey === slice.key ? null : slice.key);
                }
              }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={48} fill="#ffffff" />
        <text
          x={cx}
          y={selected ? cy - 8 : cy - 2}
          textAnchor="middle"
          className="finance-pie__center-value"
        >
          {selected
            ? formatCurrencyCompact(selected.amount)
            : totalLabel}
        </text>
        <text
          x={cx}
          y={selected ? cy + 12 : cy + 14}
          textAnchor="middle"
          className="finance-pie__center-label"
        >
          {selected ? selected.label : "Total spent"}
        </text>
      </svg>

      <ul className="finance-pie__legend">
        {slices.map((slice) => {
          const active = selectedKey === slice.key;
          return (
            <li key={slice.key}>
              <button
                type="button"
                data-testid={`expense-legend-${slice.key}`}
                className={[
                  "finance-pie__legend-item",
                  active ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={active}
                onClick={() => onSelect(active ? null : slice.key)}
              >
                <span
                  className="finance-pie__swatch"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden="true"
                />
                <span className="finance-pie__legend-name">{slice.label}</span>
                <span className="finance-pie__legend-pct">{slice.percent}%</span>
                <span className="finance-pie__legend-amt">
                  {formatCurrencyCompact(slice.amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ExpenseCategoryChart({
  categories,
  totalExpense,
  isLoading,
  errorMessage,
}: ExpenseCategoryChartProps) {
  const slices = useMemo(
    () => buildExpensePieSlices(categories, totalExpense),
    [categories, totalExpense],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const totalLabel = formatCurrencyCompact(totalExpense);

  if (isLoading) {
    return (
      <div className="finance-chart-card">
        <p className="finance-meter-empty">Loading expense categories…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div role="alert" className="ds-alert-banner p-6">
        {errorMessage}
      </div>
    );
  }

  return (
    <section className="finance-chart-card">
      <h2 className="finance-chart-card-title">Spend by category</h2>

      {slices.length === 0 ? (
        <p className="finance-meter-empty">No expenses logged for this period.</p>
      ) : (
        <div data-testid="expense-category-chart">
          <PieChart
            slices={slices}
            selectedKey={
              slices.some((slice) => slice.key === selectedKey)
                ? selectedKey
                : null
            }
            onSelect={setSelectedKey}
            totalLabel={totalLabel}
          />
        </div>
      )}
    </section>
  );
}
