import { useEffect, useState } from "react";
import axios from "axios";

import { EventBudgetBreakdown } from "../components/EventBudgetBreakdown";
import { ExpenseCategoryChart } from "../components/ExpenseCategoryChart";
import { FinanceEntryList } from "../components/FinanceEntryList";
import { FinanceSummaryCard } from "../components/FinanceSummaryCard";
import { LogFinanceEntryForm } from "../components/LogFinanceEntryForm";
import { RoleBadge } from "../components/RoleBadge";
import { useAuth } from "../context/useAuth";
import { fetchEvents } from "../lib/events-api";
import {
  fetchEventBudgetBreakdown,
  fetchExpenseByCategory,
  fetchFinanceSummary,
  type FinanceEntryResponse,
  type FinanceEventBudgetSummary,
  type FinanceExpenseCategorySummary,
  type FinanceSummaryResponse,
} from "../lib/finance-api";
import { isRoleAtLeast } from "../lib/roles";
import {
  formatSemesterLabel,
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

export function FinancePage() {
  const { member } = useAuth();
  const [semester, setSemester] = useState<string>("all");
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: "idle" });
  const [budgetState, setBudgetState] = useState<BudgetState>({ status: "loading" });
  const [expenseCategoryState, setExpenseCategoryState] = useState<ExpenseCategoryState>({
    status: "loading",
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [eventOptions, setEventOptions] = useState<Array<{ id: number; name: string }>>(
    [],
  );

  const canViewTreasury = member
    ? isRoleAtLeast(member.role, "treasurer")
    : false;

  function handleFinanceEntryCreated(_entry: FinanceEntryResponse) {
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
            response.events.map((event) => ({
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

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-white p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Finance
            </p>
            <h1 className="mt-2 text-3xl font-bold text-primary">
              {canViewTreasury ? "Treasury overview" : "Event budget tracking"}
            </h1>
            <p className="mt-3 max-w-2xl text-gray-600">
              {canViewTreasury
                ? "Track NSA income, expenses, running balance, and how each event compares to its planned budget."
                : "Review how each event is tracking against its planned budget and logged spending."}
            </p>
          </div>
          <RoleBadge role={member.role} size="md" />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-primary">Semester filter</h2>
            <p className="mt-1 text-sm text-gray-500">
              Applies to spend by category, event budgets
              {canViewTreasury ? ", and treasury totals" : ""}.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            <span className="font-medium">Semester</span>
            <select
              aria-label="Semester"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-primary"
            >
              <option value="all">All time</option>
              {semesterOptions.map((option) => (
                <option key={option} value={option}>
                  {formatSemesterLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {canViewTreasury && (
        <>
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
        </>
      )}

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
        errorMessage={budgetState.status === "error" ? budgetState.message : null}
      />

      {canViewTreasury && (
        <FinanceSummaryCard
          isLoading={summaryState.status === "loading"}
          errorMessage={
            summaryState.status === "error" ? summaryState.message : null
          }
          summary={summaryState.status === "ready" ? summaryState.summary : null}
        />
      )}
    </div>
  );
}
