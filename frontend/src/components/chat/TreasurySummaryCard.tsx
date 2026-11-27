import type { ChatFinanceSummary } from "../../lib/chat-stream";

function Money({ amount }: { amount: string }) {
  return (
    <span className="font-medium tabular-nums text-foreground">
      USD {amount}
    </span>
  );
}

export function TreasurySummaryCard({ summary }: { summary: ChatFinanceSummary }) {
  return (
    <section
      data-testid="treasury-summary"
      className="my-2 w-full min-w-0 max-w-full"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-label">
        Treasury summary
      </h3>
      <p className="mt-1 text-[11px] leading-4 text-label">
        {summary.period_label} · {summary.currency}
      </p>
      <dl className="mt-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[11px] text-label">Total income</dt>
          <dd>
            <Money amount={summary.total_income} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-label">Total expenses</dt>
          <dd>
            <Money amount={summary.total_expense} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-label">Balance</dt>
          <dd>
            <Money amount={summary.balance} />
          </dd>
        </div>
      </dl>
      <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-label">
        Expense breakdown
      </h4>
      <ul className="mt-1 min-w-0 space-y-1">
        {summary.breakdown.map((line, index) => (
          <li
            key={`${index}-${line.label}`}
            className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 break-words">{line.label}</span>
            <Money amount={line.expense} />
          </li>
        ))}
      </ul>
    </section>
  );
}
