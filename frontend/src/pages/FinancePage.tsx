import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "../lib/api-error";

import { DuesDashboard } from "../components/DuesDashboard";
import { EventBudgetBreakdown } from "../components/EventBudgetBreakdown";
import { ExpenseCategoryChart } from "../components/ExpenseCategoryChart";
import { FinanceEntryList } from "../components/FinanceEntryList";
import { FinanceInbox } from "../components/FinanceInbox";
import {
  FinanceSummaryMetrics,
  FinanceTransactionBreakdown,
} from "../components/FinanceSummaryCard";
import { LogFinanceEntryForm } from "../components/LogFinanceEntryForm";
import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/useAuth";
import { fetchEvents } from "../lib/events-api";
import { isEventFinanceEditable } from "../lib/event-finance";
import {
  fetchEventBudgetBreakdown,
  fetchExpenseByCategory,
  fetchFinanceSummary,
  fetchPendingFinanceChangeRequests,
  type FinanceEntryResponse,
  type FinanceEventBudgetSummary,
  type FinanceExpenseCategorySummary,
  type FinanceSummaryResponse,
} from "../lib/finance-api";
import { canManageTreasury } from "../lib/roles";
import {
  financeTabSearchParams,
  parseFinanceEventId,
  parseFinanceTab,
  type FinanceTab,
} from "../lib/finance-routes";
import {
  formatSemesterLabel,
  getCurrentSemesterSlug,
  getRecentSemesterOptions,
} from "../lib/semester";

type SummaryState =
  | { status: "loading" }
  | { status: "ready"; summary: FinanceSummaryResponse }
  | { status: "error"; message: string }
  | { status: "idle" };

type BudgetState =
  | { status: "loading" }
  | { status: "ready"; events: FinanceEventBudgetSummary[] }
  | { status: "error"; message: string };

type ExpenseCategoryState =
  | { status: "loading" }
  | {
      status: "ready";
      categories: FinanceExpenseCategorySummary[];
      totalExpense: string;
    }
  | { status: "error"; message: string };

const FINANCE_TABS: { id: FinanceTab; label: string }[] = [
  { id: "pulse", label: "Pulse" },
  { id: "inbox", label: "Inbox" },
  { id: "books", label: "Books" },
  { id: "dues", label: "Dues" },
];

function tabButtonClass(isActive: boolean): string {
  return [
    "inline-flex items-center rounded-pill px-4 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-white"
      : "text-label hover:text-foreground",
  ].join(" ");
}

function formatUpdatedLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function semesterFilterLabel(semester: string): string {
  return semester === "all" ? "All time" : formatSemesterLabel(semester);
}

export function FinancePage() {
  const { member } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [semester, setSemester] = useState<string>("all");
  const tabParam = searchParams.get("tab");
  const activeTab = parseFinanceTab(tabParam);
  const booksEventId =
    activeTab === "books" ? parseFinanceEventId(searchParams.get("event_id")) : null;
  const autoOpenedInbox = useRef(false);
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: "idle" });
  const [budgetState, setBudgetState] = useState<BudgetState>({ status: "loading" });
  const [expenseCategoryState, setExpenseCategoryState] = useState<ExpenseCategoryState>({
    status: "loading",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [eventOptions, setEventOptions] = useState<Array<{ id: number; name: string }>>(
    [],
  );
  const [filterEventOptions, setFilterEventOptions] = useState<
    Array<{ id: number; name: string }>
  >([]);

  const canViewTreasury = member
    ? canManageTreasury(member.role, member.position)
    : false;

  function switchTab(tab: FinanceTab) {
    setSearchParams(financeTabSearchParams(tab));
  }

  function openBooksForEvent(eventId?: number | null) {
    setSearchParams(financeTabSearchParams("books", { eventId: eventId ?? null }));
  }

  function setBooksEventFilter(eventId: number | null) {
    setSearchParams(financeTabSearchParams("books", { eventId }), { replace: true });
  }

  function handleFinanceEntryCreated(_entry: FinanceEntryResponse) {
    setRefreshKey((current) => current + 1);
  }

  function handleApprovalsChanged() {
    setRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    if (!canViewTreasury || autoOpenedInbox.current || tabParam !== null) {
      return;
    }

    if (pendingApprovalCount > 0) {
      autoOpenedInbox.current = true;
      setSearchParams(financeTabSearchParams("inbox"), { replace: true });
    }
  }, [canViewTreasury, pendingApprovalCount, tabParam, setSearchParams]);

  useEffect(() => {
    if (!canViewTreasury) {
      return;
    }

    let cancelled = false;

    async function loadEventOptions() {
      try {
        const response = await fetchEvents();
        if (!cancelled) {
          const options = response.events.map((event) => ({
            id: event.id,
            name: event.name,
          }));
          setFilterEventOptions(options);
          setEventOptions(
            response.events
              .filter((event) => isEventFinanceEditable(event))
              .map((event) => ({
                id: event.id,
                name: event.name,
              })),
          );
        }
      } catch {
        if (!cancelled) {
          setFilterEventOptions([]);
          setEventOptions([]);
        }
      }
    }

    void loadEventOptions();

    return () => {
      cancelled = true;
    };
  }, [canViewTreasury, refreshKey]);

  useEffect(() => {
    if (!canViewTreasury) {
      return;
    }

    let cancelled = false;

    async function loadPendingCount() {
      try {
        const response = await fetchPendingFinanceChangeRequests();
        if (!cancelled) {
          setPendingApprovalCount(response.total);
        }
      } catch {
        if (!cancelled) {
          setPendingApprovalCount(0);
        }
      }
    }

    void loadPendingCount();

    return () => {
      cancelled = true;
    };
  }, [canViewTreasury, refreshKey]);

  useEffect(() => {
    if (!canViewTreasury) {
      setExpenseCategoryState({ status: "loading" });
      return;
    }

    let cancelled = false;

    async function loadExpenseCategories() {
      setExpenseCategoryState({ status: "loading" });

      try {
        const response = await fetchExpenseByCategory(
          semester === "all" ? undefined : { semester },
        );

        if (!cancelled) {
          setExpenseCategoryState({
            status: "ready",
            categories: response.categories,
            totalExpense: response.total_expense,
          });
          setLastUpdated(new Date());
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setExpenseCategoryState({
          status: "error",
          message: getApiErrorMessage(
            error,
            "Unable to load expense categories.",
          ),
        });
      }
    }

    void loadExpenseCategories();

    return () => {
      cancelled = true;
    };
  }, [semester, refreshKey, canViewTreasury]);

  useEffect(() => {
    let cancelled = false;

    async function loadBudgetBreakdown() {
      setBudgetState({ status: "loading" });

      try {
        const response = await fetchEventBudgetBreakdown(
          semester === "all" ? undefined : { semester },
        );

        if (!cancelled) {
          setBudgetState({ status: "ready", events: response.events });
          setLastUpdated(new Date());
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBudgetState({
          status: "error",
          message: getApiErrorMessage(
            error,
            "Unable to load event budget breakdown.",
          ),
        });
      }
    }

    void loadBudgetBreakdown();

    return () => {
      cancelled = true;
    };
  }, [semester, refreshKey]);

  useEffect(() => {
    if (!canViewTreasury) {
      setSummaryState({ status: "idle" });
      return;
    }

    let cancelled = false;

    async function loadSummary() {
      setSummaryState({ status: "loading" });

      try {
        const summary = await fetchFinanceSummary(
          semester === "all" ? undefined : { semester },
        );

        if (!cancelled) {
          setSummaryState({ status: "ready", summary });
          setLastUpdated(new Date());
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSummaryState({
          status: "error",
          message: getApiErrorMessage(error, "Unable to load finance summary."),
        });
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [semester, canViewTreasury, refreshKey]);

  if (!member) {
    return null;
  }

  const semesterOptions = getRecentSemesterOptions();
  const summary =
    summaryState.status === "ready" ? summaryState.summary : null;
  const semesterLabel = semesterFilterLabel(semester);
  const updatedLabel = lastUpdated ? formatUpdatedLabel(lastUpdated) : "—";
  const duesSemester =
    semester === "all" ? getCurrentSemesterSlug() : semester;
  const overBudgetEvents =
    budgetState.status === "ready"
      ? budgetState.events.filter((event) => event.over_budget)
      : [];

  const booksFilterOptions =
    booksEventId != null &&
    !filterEventOptions.some((event) => event.id === booksEventId)
      ? [{ id: booksEventId, name: `Event #${booksEventId}` }, ...filterEventOptions]
      : filterEventOptions;

  const charts = (
    <div className="grid gap-6 lg:grid-cols-2">
      <ExpenseCategoryChart
        categories={
          expenseCategoryState.status === "ready"
            ? expenseCategoryState.categories
            : []
        }
        totalExpense={
          expenseCategoryState.status === "ready"
            ? expenseCategoryState.totalExpense
            : "0.00"
        }
        isLoading={expenseCategoryState.status === "loading"}
        errorMessage={
          expenseCategoryState.status === "error"
            ? expenseCategoryState.message
            : null
        }
      />

      <EventBudgetBreakdown
        events={budgetState.status === "ready" ? budgetState.events : []}
        isLoading={budgetState.status === "loading"}
        errorMessage={
          budgetState.status === "error" ? budgetState.message : null
        }
        onEventClick={canViewTreasury ? openBooksForEvent : undefined}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light tracking-headline text-foreground md:text-3xl">
              {canViewTreasury ? "Treasury" : "Event budget tracking"}
            </h1>
            <p className="mt-1 text-sm text-label">
              {semesterLabel} · updated {updatedLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Semester"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm text-foreground shadow-sm"
            >
              <option value="all">All time</option>
              {semesterOptions.map((option) => (
                <option key={option} value={option}>
                  {formatSemesterLabel(option)}
                </option>
              ))}
            </select>
            <RoleBadge role={member.role} size="md" />
          </div>
        </div>

        {canViewTreasury ? (
          <nav aria-label="Finance sections" className="mt-6 flex gap-2 overflow-x-auto">
            {FINANCE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const showBadge = tab.id === "inbox" && pendingApprovalCount > 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className={tabButtonClass(isActive)}
                >
                  {tab.label}
                  {showBadge ? (
                    <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-overdue px-1.5 text-xs font-semibold text-white">
                      {pendingApprovalCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        ) : null}
      </header>

      {!canViewTreasury ? (
        <div className="space-y-6">
          <EventBudgetBreakdown
            events={budgetState.status === "ready" ? budgetState.events : []}
            isLoading={budgetState.status === "loading"}
            errorMessage={
              budgetState.status === "error" ? budgetState.message : null
            }
          />
        </div>
      ) : null}

      {canViewTreasury && activeTab === "pulse" ? (
        <div className="space-y-6">
          <FinanceSummaryMetrics
            isLoading={summaryState.status === "loading"}
            errorMessage={
              summaryState.status === "error" ? summaryState.message : null
            }
            summary={summary}
          />

          <details className="group rounded-card border border-gray-200 bg-surface-card shadow-card">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                Insights
                <span className="text-xs font-normal text-label group-open:hidden">
                  Spend by category · Event budgets
                </span>
              </span>
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-4">{charts}</div>
          </details>
        </div>
      ) : null}

      {canViewTreasury && activeTab === "inbox" ? (
        <FinanceInbox
          duesSemester={duesSemester}
          overBudgetEvents={overBudgetEvents}
          refreshKey={refreshKey}
          onChanged={handleApprovalsChanged}
          onOpenDues={() => switchTab("dues")}
          onOpenPulse={() => switchTab("pulse")}
          onOpenBooksForEvent={openBooksForEvent}
        />
      ) : null}

      {canViewTreasury && activeTab === "books" ? (
        <div className="space-y-6">
          <LogFinanceEntryForm
            eventOptions={eventOptions}
            onCreated={handleFinanceEntryCreated}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
              <span className="text-label">Event</span>
              <select
                aria-label="Filter by event"
                value={booksEventId ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setBooksEventFilter(value ? Number.parseInt(value, 10) : null);
                }}
                className="rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm text-foreground shadow-sm"
              >
                <option value="">All events</option>
                {booksFilterOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            {booksEventId != null ? (
              <button
                type="button"
                onClick={() => setBooksEventFilter(null)}
                className="text-sm font-medium text-label underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear event filter
              </button>
            ) : null}
          </div>
          <FinanceEntryList
            semester={semester}
            refreshKey={refreshKey}
            eventId={booksEventId ?? undefined}
            canManage={canViewTreasury}
            onChanged={() => setRefreshKey((current) => current + 1)}
          />
          <details className="rounded-card border border-gray-200 bg-surface-card shadow-card">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              Transaction breakdown
            </summary>
            <div className="border-t border-gray-100 px-5 pb-5 pt-4">
              <FinanceTransactionBreakdown
                summary={summary}
                embedded
                onEventClick={openBooksForEvent}
              />
            </div>
          </details>
        </div>
      ) : null}

      {canViewTreasury && activeTab === "dues" ? (
        <div className="space-y-4">
          {semester === "all" ? (
            <p className="text-sm text-label">
              Showing dues for {formatSemesterLabel(duesSemester)}. Choose a semester above to switch terms.
            </p>
          ) : null}
          <DuesDashboard
            semester={duesSemester}
            refreshKey={refreshKey}
            onChanged={() => setRefreshKey((current) => current + 1)}
          />
        </div>
      ) : null}
    </div>
  );
}
