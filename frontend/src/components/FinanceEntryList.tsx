import { useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  CUSTOM_FINANCE_CATEGORY,
  financeCategoryToFormValue,
  formatFinanceCategory,
  resolveFinanceCategoryForSubmit,
  validateCustomFinanceCategory,
} from "../lib/finance-categories";
import {
  deleteFinanceEntry,
  fetchFinanceEntries,
  updateFinanceEntry,
  type FinanceEntryResponse,
  type FinanceEntryType,
} from "../lib/finance-api";
import { FINANCE_CATEGORIES } from "../lib/finance-form";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";

type FinanceEntryListProps = {
  semester: string;
  refreshKey: number;
  canManage?: boolean;
  financeLocked?: boolean;
  eventId?: number;
  onChanged?: () => void;
};

type EditDraft = {
  entry_type: FinanceEntryType;
  category: string;
  customCategory: string;
  amount: string;
  description: string;
};

const editInputClassName =
  "w-full rounded-md border border-gray-200 px-2 py-1 text-sm font-light text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40";

export function FinanceEntryList({
  semester,
  refreshKey,
  canManage = false,
  financeLocked = false,
  eventId,
  onChanged,
}: FinanceEntryListProps) {
  const [entries, setEntries] = useState<FinanceEntryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return entries;
    }

    return entries.filter((entry) => {
      const description = entry.description.toLowerCase();
      const category = formatFinanceCategory(entry.category).toLowerCase();
      return description.includes(normalized) || category.includes(normalized);
    });
  }, [entries, searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchFinanceEntries({
          ...(semester === "all" ? {} : { semester }),
          ...(eventId ? { event_id: eventId } : {}),
        });

        if (!cancelled) {
          setEntries(response.entries);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail;
          setErrorMessage(
            typeof detail === "string"
              ? detail
              : "Unable to load finance entries.",
          );
          return;
        }

        setErrorMessage("Unable to load finance entries.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [semester, refreshKey, eventId]);

  function startEdit(entry: FinanceEntryResponse) {
    setActionError(null);
    setEditingId(entry.id);
    const categoryValues = financeCategoryToFormValue(entry.category);
    setDraft({
      entry_type: entry.entry_type,
      category: categoryValues.category,
      customCategory: categoryValues.customCategory,
      amount: entry.amount,
      description: entry.description,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setActionError(null);
  }

  function getApiErrorDetail(error: unknown, fallback: string): string {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
    return fallback;
  }

  async function saveEdit(entryId: number) {
    if (!draft) {
      return;
    }

    const trimmedAmount = draft.amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmedAmount) || Number(trimmedAmount) <= 0) {
      setActionError("Enter a valid amount greater than 0 (max two decimals).");
      return;
    }

    if (draft.category === CUSTOM_FINANCE_CATEGORY) {
      const customError = validateCustomFinanceCategory(draft.customCategory);
      if (customError) {
        setActionError(customError);
        return;
      }
    }

    setBusyId(entryId);
    setActionError(null);
    setActionNotice(null);

    try {
      await updateFinanceEntry(entryId, {
        entry_type: draft.entry_type,
        category: resolveFinanceCategoryForSubmit(
          draft.category,
          draft.customCategory,
        ),
        amount: trimmedAmount,
        description: draft.description.trim(),
      });
      cancelEdit();
      setActionNotice(
        "Change submitted for approval. The entry will update once the president or treasurer approves it.",
      );
      onChanged?.();
    } catch (error) {
      setActionError(getApiErrorDetail(error, "Unable to update entry."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(entry: FinanceEntryResponse) {
    const label = `${entry.entry_type} of ${formatCurrency(entry.amount)}`;
    if (
      !window.confirm(
        `Request deletion of this ${label}? It will be removed after approval.`,
      )
    ) {
      return;
    }

    setBusyId(entry.id);
    setActionError(null);
    setActionNotice(null);

    try {
      await deleteFinanceEntry(entry.id);
      if (editingId === entry.id) {
        cancelEdit();
      }
      setActionNotice(
        "Delete request submitted for approval. The entry will be removed once approved.",
      );
      onChanged?.();
    } catch (error) {
      setActionError(getApiErrorDetail(error, "Unable to delete entry."));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="ds-card p-10 text-center text-label">
        Loading transactions...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="ds-alert-banner p-6"
      >
        {errorMessage}
      </div>
    );
  }

  const columnCount = canManage ? 7 : 6;

  return (
    <section className="ds-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-base font-medium text-foreground">
          Recent transactions
        </h2>
        <label className="min-w-[14rem] flex-1 text-sm text-label sm:max-w-xs">
          <span className="sr-only">Search transactions</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search description or category"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-light text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </label>
      </div>

      {financeLocked ? (
        <p className="mt-4 ds-card-nested px-3 py-2 text-sm text-foreground">
          Event finances are closed. These entries are preserved for accountability
          and can no longer be edited.
        </p>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          className="mt-4 ds-alert-banner"
        >
          {actionError}
        </p>
      ) : null}

      {actionNotice ? (
        <p className="mt-4 rounded-md border border-accent/20 bg-accent/5 px-3 py-2 text-sm text-foreground">
          {actionNotice}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table
          data-testid="finance-entry-list"
          className="min-w-full divide-y divide-gray-200 text-left text-sm"
        >
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-label">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Receipt</th>
              {canManage ? (
                <th className="px-4 py-3 font-semibold">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEntries.map((entry) => {
              const isEditing = canManage && editingId === entry.id && draft;
              const isBusy = busyId === entry.id;

              if (isEditing) {
                return (
                  <tr key={entry.id} className="bg-accent/5">
                    <td className="px-4 py-3 text-label">
                      {formatEventDateTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label="Edit type"
                        value={draft.entry_type}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            entry_type: event.target.value as FinanceEntryType,
                          })
                        }
                        className={editInputClassName}
                      >
                        <option value="income">income</option>
                        <option value="expense">expense</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <select
                          aria-label="Edit category"
                          value={draft.category}
                          onChange={(event) =>
                            setDraft({ ...draft, category: event.target.value })
                          }
                          className={editInputClassName}
                        >
                          {FINANCE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {formatFinanceCategory(category)}
                            </option>
                          ))}
                          <option value={CUSTOM_FINANCE_CATEGORY}>Add your own…</option>
                        </select>
                        {draft.category === CUSTOM_FINANCE_CATEGORY ? (
                          <input
                            aria-label="Edit custom category"
                            type="text"
                            value={draft.customCategory}
                            placeholder="Custom category"
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                customCategory: event.target.value,
                              })
                            }
                            className={editInputClassName}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label="Edit amount"
                        type="text"
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(event) =>
                          setDraft({ ...draft, amount: event.target.value })
                        }
                        className={editInputClassName}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label="Edit description"
                        type="text"
                        value={draft.description}
                        onChange={(event) =>
                          setDraft({ ...draft, description: event.target.value })
                        }
                        className={editInputClassName}
                      />
                    </td>
                    <td className="px-4 py-3 text-label">—</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEdit(entry.id)}
                          disabled={isBusy}
                          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isBusy}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-gray-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-label">
                    {formatEventDateTime(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 capitalize text-foreground">
                    {entry.entry_type}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatFinanceCategory(entry.category)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      entry.entry_type === "income"
                        ? "text-accent"
                        : "text-foreground"
                    }`}
                  >
                    {formatCurrency(entry.amount)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {entry.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {entry.receipt_url ? (
                      <a
                        href={entry.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-label">—</span>
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          disabled={isBusy || editingId !== null}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-foreground transition hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(entry)}
                          disabled={isBusy || editingId !== null}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-label transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {filteredEntries.length === 0 && (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-8 text-center text-label"
                >
                  {entries.length === 0
                    ? "No transactions logged for this period."
                    : "No transactions match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
