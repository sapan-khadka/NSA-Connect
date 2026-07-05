import { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";

import { DuesDashboard } from "../components/DuesDashboard";
import { EventBudgetBreakdown } from "../components/EventBudgetBreakdown";
import { ExpenseCategoryChart } from "../components/ExpenseCategoryChart";
import { FinanceEntryList } from "../components/FinanceEntryList";
import { FinanceMyChangeRequests } from "../components/FinanceMyChangeRequests";
import { FinancePendingApprovals } from "../components/FinancePendingApprovals";
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
import { isRoleAtLeast } from "../lib/roles";
import {
  financeTabSearchParams,
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

type FinanceTabId = FinanceTab;

const FINANCE_TABS: { id: FinanceTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "dues", label: "Dues" },
  { id: "approvals", label: "Approvals" },
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

function FinancePageMenuButton() {
  return (
    <button
      type="button"
      aria-label="More actions"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-label transition-colors hover:bg-gray-100 hover:text-foreground"
    >
      ⋯
    </button>
  );
}

export function FinancePage() {
  const { member } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [semester, setSemester] = useState<string>("all");
  const activeTab = parseFinanceTab(searchParams.get("tab"));
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

  const canViewTreasury = member
    ? isRoleAtLeast(member.role, "treasurer")
    : false;

  function switchTab(tab: FinanceTabId) {
    setSearchParams(financeTabSearchParams(tab));
  }

  function handleFinanceEntryCreated(_entry: FinanceEntryResponse) {
    setRefreshKey((current) => current + 1);
  }

  function handleApprovalsChanged() {
    setRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    if (!canViewTreasury) {
      return;
    }

    let cancelled = false;

    async function loadEventOptions() {
      try {
        const response = await fetchEvents();
        if (!cancelled) {
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

        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail;
          setExpenseCategoryState({
            status: "error",
            message:
              typeof detail === "string"
                ? detail
                : "Unable to load expense categories.",
          });
          return;
        }

        setExpenseCategoryState({
          status: "error",
          message: "Unable to load expense categories.",
        });
      }
    }

    void loadExpenseCategories();

    return () => {
      cancelled = true;
    };
  }, [semester, refreshKey]);

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

        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail;
          setBudgetState({
            status: "error",
            message:
              typeof detail === "string"
                ? detail
                : "Unable to load event budget breakdown.",
          });
          return;
        }

        setBudgetState({
          status: "error",
          message: "Unable to load event budget breakdown.",
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

        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail;
          setSummaryState({
            status: "error",
            message:
              typeof detail === "string"
                ? detail
                : "Unable to load finance summary.",
          });
          return;
        }

        setSummaryState({
          status: "error",
          message: "Unable to load finance summary.",
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
            {canViewTreasury ? <FinancePageMenuButton /> : null}
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
              const showBadge = tab.id === "approvals" && pendingApprovalCount > 0;

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

      {(!canViewTreasury || activeTab === "overview") && (
        <div className="space-y-6">
          {canViewTreasury ? (
            <FinanceSummaryMetrics
              isLoading={summaryState.status === "loading"}
              errorMessage={
                summaryState.status === "error" ? summaryState.message : null
              }
              summary={summary}
              pendingCount={pendingApprovalCount}
            />
          ) : null}

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
            />
          </div>
        </div>
      )}

      {canViewTreasury && activeTab === "transactions" ? (
        <div className="space-y-6">
          <LogFinanceEntryForm
            eventOptions={eventOptions}
            onCreated={handleFinanceEntryCreated}
          />
          <FinanceEntryList
            semester={semester}
            refreshKey={refreshKey}
            canManage={canViewTreasury}
            onChanged={() => setRefreshKey((current) => current + 1)}
          />
          <FinanceTransactionBreakdown summary={summary} />
        </div>
      ) : null}

      {canViewTreasury && activeTab === "approvals" ? (
        <div className="space-y-6">
          <FinancePendingApprovals
            refreshKey={refreshKey}
            onChanged={handleApprovalsChanged}
          />
          <FinanceMyChangeRequests refreshKey={refreshKey} />
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
