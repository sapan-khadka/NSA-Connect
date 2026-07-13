import {
  budgetProgressBarClass,
  budgetUsagePercent,
  formatBudgetRemaining,
  type EventBudgetRow,
} from "../lib/event-budget";
import {
  EVENT_MANAGE_ACTION_LINK,
  EVENT_MANAGE_CARD_CLASS,
  EVENT_MANAGE_EMPTY,
  EVENT_MANAGE_EYEBROW,
} from "../lib/event-manage-ui";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import {
  formatCurrency,
  parseCurrencyAmount,
} from "../lib/format-currency";
import { HomeCard } from "./ui/HomeCard";

type EventManageBudgetCardProps = {
  budget: FinanceEventBudgetSummary | null;
  canViewTreasury: boolean;
  onViewTransactions: () => void;
};

type HealthTone = {
  label: "Healthy" | "Warning" | "Over Budget";
  badgeClass: string;
  meterClass: string;
};

/** Presentation-only health badge — uses existing over_budget + usage %. */
function budgetHealthTone(row: EventBudgetRow): HealthTone {
  if (row.over_budget) {
    return {
      label: "Over Budget",
      badgeClass: "bg-red-50 text-red-700 ring-red-100/80",
      meterClass: "bg-red-500",
    };
  }

  const usage = budgetUsagePercent(row.planned_budget, row.actual_expense);
  if (usage >= 80) {
    return {
      label: "Warning",
      badgeClass: "bg-amber-50 text-amber-800 ring-amber-100/80",
      meterClass: "bg-amber-500",
    };
  }

  return {
    label: "Healthy",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-100/80",
    meterClass: budgetProgressBarClass(row),
  };
}

function MetricCell({
  label,
  value,
  emphasis = false,
  toneClass = "text-foreground",
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  toneClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-2.5">
      <p className={EVENT_MANAGE_EYEBROW}>{label}</p>
      <p
        className={`mt-1 tabular-nums tracking-tight ${
          emphasis ? "text-lg font-semibold" : "text-sm font-semibold"
        } ${toneClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function SpendMixChart({
  planned,
  spent,
  remaining,
}: {
  planned: number;
  spent: number;
  remaining: number;
}) {
  const safePlanned = Math.max(planned, 0);
  const clampedSpent = Math.max(0, Math.min(spent, safePlanned || spent));
  const clampedRemaining = Math.max(0, remaining);

  // Compact stacked bar — proportions from existing planned/spent/remaining amounts.
  const total = safePlanned > 0 ? safePlanned : clampedSpent + clampedRemaining;
  const spentPct = total > 0 ? Math.min(100, (clampedSpent / total) * 100) : 0;
  const remainPct =
    total > 0 ? Math.min(100 - spentPct, (clampedRemaining / total) * 100) : 0;

  return (
    <div className="mt-3" aria-hidden="true">
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full bg-gray-700/80 transition-all duration-200"
          style={{ width: `${spentPct}%` }}
        />
        <div
          className="h-full bg-emerald-400/70 transition-all duration-200"
          style={{ width: `${remainPct}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-700/80" />
          Spent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
          Remaining
        </span>
      </div>
    </div>
  );
}

export function EventManageBudgetCard({
  budget,
  canViewTreasury,
  onViewTransactions,
}: EventManageBudgetCardProps) {
  if (!budget) {
    return (
      <div id="event-manage-budget" className="h-full min-h-0">
        <HomeCard
          padding="sm"
          className={EVENT_MANAGE_CARD_CLASS}
          aria-label="Budget"
        >
          <h2 className="home-section-title">Budget</h2>
          <div className={`mt-3 flex flex-1 flex-col ${EVENT_MANAGE_EMPTY}`}>
            <p className="text-sm font-medium text-foreground">
              Budget unavailable
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
              Planned budget and spend will appear here when finance data is
              ready.
            </p>
          </div>
        </HomeCard>
      </div>
    );
  }

  const health = budgetHealthTone(budget);
  const usage = budgetUsagePercent(
    budget.planned_budget,
    budget.actual_expense,
  );
  const planned = parseCurrencyAmount(budget.planned_budget);
  const spent = parseCurrencyAmount(budget.actual_expense);
  const income = parseCurrencyAmount(budget.actual_income);
  const remaining = parseCurrencyAmount(budget.budget_remaining);
  const netBalance = income - spent;
  const netTone =
    netBalance > 0
      ? "text-emerald-700"
      : netBalance < 0
        ? "text-red-700"
        : "text-foreground";

  return (
    <div id="event-manage-budget" className="h-full min-h-0">
      <HomeCard
        padding="sm"
        className={EVENT_MANAGE_CARD_CLASS}
        aria-label="Budget"
      >
        <div className="flex shrink-0 items-start justify-between gap-2">
          <div>
            <h2 className="home-section-title">Budget</h2>
            <p className="mt-1 text-xs text-gray-500">Budget Health</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${health.badgeClass}`}
            >
              {health.label}
            </span>
            {canViewTreasury ? (
              <button
                type="button"
                onClick={onViewTransactions}
                className={EVENT_MANAGE_ACTION_LINK}
              >
                View transactions
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs font-medium text-gray-500">
              {usage}% of planned used
            </p>
            <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
              {formatBudgetRemaining(budget.budget_remaining)}
              <span className="ml-1 text-xs font-medium text-gray-400">
                left
              </span>
            </p>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuenow={usage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Budget usage"
          >
            <div
              className={`h-full rounded-full transition-all duration-200 ease-out ${health.meterClass}`}
              style={{ width: `${usage}%` }}
            />
          </div>
          <SpendMixChart
            planned={planned}
            spent={spent}
            remaining={remaining}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MetricCell
            label="Remaining"
            value={formatBudgetRemaining(budget.budget_remaining)}
            emphasis
            toneClass={
              remaining < 0
                ? "text-red-700"
                : remaining === 0
                  ? "text-foreground"
                  : "text-emerald-700"
            }
          />
          <MetricCell
            label="Spent"
            value={formatCurrency(budget.actual_expense)}
          />
          <MetricCell
            label="Planned"
            value={formatCurrency(budget.planned_budget)}
          />
          <MetricCell
            label="Net Balance"
            value={formatCurrency(netBalance)}
            toneClass={netTone}
          />
        </div>
      </HomeCard>
    </div>
  );
}
