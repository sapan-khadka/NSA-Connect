import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import {
  getEventFinanceStatusClass,
  getEventFinanceStatusLabel,
} from "../lib/event-finance";
import { fetchPastEvents, type EventResponse } from "../lib/events-api";
import { EVENT_TYPE_BADGE_CLASS, EVENT_TYPE_LABELS } from "../lib/event-types";
import {
  budgetStatusClass,
  budgetStatusLabel,
  formatBudgetRemaining,
} from "../lib/event-budget";
import { fetchEventBudgetBreakdown, type FinanceEventBudgetSummary } from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";
import { isRoleAtLeast } from "../lib/roles";

export function PastEventsPage() {
  const { member } = useAuth();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [budgetByEventId, setBudgetByEventId] = useState<
    Record<number, FinanceEventBudgetSummary>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = member ? isRoleAtLeast(member.role, "board") : false;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [pastEvents, budgetResponse] = await Promise.all([
          fetchPastEvents(),
          canManage
            ? fetchEventBudgetBreakdown()
            : Promise.resolve({ events: [], total: 0 }),
        ]);

        if (cancelled) {
          return;
        }

        setEvents(pastEvents.events);
        setBudgetByEventId(
          Object.fromEntries(
            budgetResponse.events.map((summary) => [summary.event_id, summary]),
          ),
        );
      } catch (caught) {
        if (!cancelled) {
          setError(getApiErrorMessage(caught));
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
  }, [canManage]);

  const summary = useMemo(() => {
    const closed = events.filter((event) => event.is_finance_locked).length;
    const grace = events.filter((event) => event.is_finance_grace_period).length;
    return { closed, grace };
  }, [events]);

  return (
    <div className="space-y-8">
      {!isLoading && events.length > 0 ? (
        <p className="text-sm text-gray-500">
          {summary.grace > 0
            ? `${summary.grace} event${summary.grace === 1 ? "" : "s"} still in the close-out window. `
            : ""}
          {summary.closed} closed for editing.
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading past events…</p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800"
        >
          {error}
        </div>
      ) : null}

      {!isLoading && !error && events.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-primary">No past events yet</p>
          <p className="mt-2 text-gray-500">
            Completed events will appear here with their final budget summaries.
          </p>
          <Link
            to="/events/calendar"
            className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
          >
            View calendar
          </Link>
        </section>
      ) : null}

      {!isLoading && !error && events.length > 0 ? (
        <div className="grid gap-4">
          {events.map((event) => {
            const budget = budgetByEventId[event.id];

            return (
              <article
                key={event.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-primary">
                        {event.name}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_BADGE_CLASS[event.event_type]}`}
                      >
                        {EVENT_TYPE_LABELS[event.event_type]}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getEventFinanceStatusClass(event)}`}
                      >
                        {getEventFinanceStatusLabel(event)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatEventDateTime(event.starts_at)}
                    </p>
                  </div>

                  {canManage ? (
                    <Link
                      to={`/events/${event.id}/manage`}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-primary transition hover:border-accent hover:bg-accent/5"
                    >
                      View close-out
                    </Link>
                  ) : null}
                </div>

                {budget ? (
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">
                        Planned
                      </dt>
                      <dd className="mt-1 font-semibold text-primary">
                        {formatCurrency(budget.planned_budget)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">
                        Expenses
                      </dt>
                      <dd className="mt-1 font-semibold text-primary">
                        {formatCurrency(budget.actual_expense)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">
                        Income
                      </dt>
                      <dd className="mt-1 font-semibold text-primary">
                        {formatCurrency(budget.actual_income)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">
                        Remaining
                      </dt>
                      <dd className="mt-1 font-semibold text-primary">
                        {formatBudgetRemaining(budget.budget_remaining)}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {budget ? (
                  <p className={`mt-3 text-sm ${budgetStatusClass(budget)}`}>
                    {budgetStatusLabel(budget)}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
