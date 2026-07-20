import { AlertTriangle, BadgeDollarSign } from "lucide-react";
import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import { fetchDuesDashboard, type MemberDuesRecord } from "../lib/dues-api";
import { duesStatusLabel, duesStatusToneClass } from "../lib/dues";
import type { FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatCurrency, parseCurrencyAmount } from "../lib/format-currency";
import { formatSemesterLabel } from "../lib/semester";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { FinanceMyChangeRequests } from "./FinanceMyChangeRequests";
import { FinancePendingApprovals } from "./FinancePendingApprovals";

const DUES_SHORTLIST_LIMIT = 6;

type FinanceInboxProps = {
  duesSemester: string;
  overBudgetEvents: FinanceEventBudgetSummary[];
  refreshKey?: number;
  onChanged?: () => void;
  onOpenDues: () => void;
  onOpenPulse: () => void;
  onOpenBooksForEvent: (eventId: number) => void;
};

function outstandingAmount(record: MemberDuesRecord): number {
  return Math.max(
    0,
    parseCurrencyAmount(record.amount_owed) -
      parseCurrencyAmount(record.amount_paid),
  );
}

function FinanceInboxDuesShortlist({
  semester,
  refreshKey,
  onOpenDues,
}: {
  semester: string;
  refreshKey: number;
  onOpenDues: () => void;
}) {
  const [records, setRecords] = useState<MemberDuesRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchDuesDashboard({ semester });
        if (cancelled) {
          return;
        }
        const outstanding = response.records
          .filter(
            (record) =>
              record.status === "unpaid" || record.status === "partial",
          )
          .sort((left, right) => outstandingAmount(right) - outstandingAmount(left));
        setRecords(outstanding);
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught, "Unable to load dues follow-ups."));
          setRecords([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [semester, refreshKey]);

  if (isLoading) {
    return (
      <Card padding="md">
        <p className="text-sm text-label">Loading dues follow-ups…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="md">
        <p className="ds-field-error text-sm" role="alert">
          {error}
        </p>
      </Card>
    );
  }

  if (records.length === 0) {
    return null;
  }

  const shortlist = records.slice(0, DUES_SHORTLIST_LIMIT);

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="ds-icon-label">
            <AppIcon icon={BadgeDollarSign} size="sm" className="text-label" />
            <h2 className="text-base font-medium text-foreground">
              Unpaid dues
            </h2>
          </div>
          <p className="mt-1 text-sm text-label">
            {records.length} member{records.length === 1 ? "" : "s"} still owe
            for {formatSemesterLabel(semester)}.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpenDues}>
          Open Dues
        </Button>
      </div>

      <ul className="mt-4 divide-y divide-gray-100">
        {shortlist.map((record) => (
          <li
            key={record.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {record.member_name}
              </p>
              <p className="truncate text-xs text-label">{record.member_email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${duesStatusToneClass(record.status)}`}
              >
                {duesStatusLabel(record.status)}
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(outstandingAmount(record))}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {records.length > DUES_SHORTLIST_LIMIT ? (
        <p className="mt-3 text-xs text-label">
          +{records.length - DUES_SHORTLIST_LIMIT} more in Dues
        </p>
      ) : null}
    </Card>
  );
}

function FinanceInboxBudgetAlerts({
  events,
  onOpenPulse,
  onOpenBooksForEvent,
}: {
  events: FinanceEventBudgetSummary[];
  onOpenPulse: () => void;
  onOpenBooksForEvent: (eventId: number) => void;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <Card padding="md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="ds-icon-label">
            <AppIcon icon={AlertTriangle} size="sm" className="text-overdue" />
            <h2 className="text-base font-medium text-foreground">
              Over budget
            </h2>
          </div>
          <p className="mt-1 text-sm text-label">
            {events.length} event{events.length === 1 ? "" : "s"} over planned
            spend. Open an event for its Books.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onOpenPulse}>
          View Pulse
        </Button>
      </div>

      <ul className="mt-4 space-y-3">
        {events.map((event) => (
          <li key={event.event_id}>
            <button
              type="button"
              onClick={() => onOpenBooksForEvent(event.event_id)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-overdue/20 bg-overdue-surface/40 px-3 py-2.5 text-left transition-colors hover:border-overdue/40"
            >
              <p className="text-sm font-medium text-foreground">
                {event.event_name}
              </p>
              <p className="text-sm text-overdue">
                {formatCurrency(event.actual_expense)} /{" "}
                {formatCurrency(event.planned_budget)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function FinanceInbox({
  duesSemester,
  overBudgetEvents,
  refreshKey = 0,
  onChanged,
  onOpenDues,
  onOpenPulse,
  onOpenBooksForEvent,
}: FinanceInboxProps) {
  return (
    <div className="space-y-6" data-testid="finance-inbox">
      <FinancePendingApprovals refreshKey={refreshKey} onChanged={onChanged} />
      <FinanceInboxDuesShortlist
        semester={duesSemester}
        refreshKey={refreshKey}
        onOpenDues={onOpenDues}
      />
      <FinanceInboxBudgetAlerts
        events={overBudgetEvents}
        onOpenPulse={onOpenPulse}
        onOpenBooksForEvent={onOpenBooksForEvent}
      />
      <FinanceMyChangeRequests refreshKey={refreshKey} />
    </div>
  );
}
