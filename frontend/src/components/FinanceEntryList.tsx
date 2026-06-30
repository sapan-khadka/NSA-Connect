import { useEffect, useState } from "react";
import axios from "axios";

import {
  FINANCE_CATEGORY_LABELS,
  formatFinanceCategory,
} from "../lib/finance-categories";
import {
  deleteFinanceEntry,
  fetchFinanceEntries,
  updateFinanceEntry,
  type FinanceEntryResponse,
  type FinanceEntryType,
} from "../lib/finance-api";
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
  amount: string;
  description: string;
};

const CATEGORY_OPTIONS = Object.keys(FINANCE_CATEGORY_LABELS);

const editInputClassName =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
    setDraft({
      entry_type: entry.entry_type,
      category: entry.category,
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

    setBusyId(entryId);
    setActionError(null);
    setActionNotice(null);

    try {
      await updateFinanceEntry(entryId, {
        entry_type: draft.entry_type,
        category: draft.category,
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
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
        Loading transactions...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800"
      >
        {errorMessage}
      </div>
    );
  }

  const columnCount = canManage ? 7 : 6;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Recent transactions</h2>
        <p className="mt-1 text-sm text-gray-500">
          Latest logged income and expense entries for the selected semester.
        </p>
      </div>

      {financeLocked ? (
        <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Event finances are closed. These entries are preserved for accountability
          and can no longer be edited.
        </p>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      ) : null}

      {actionNotice ? (
        <p className="mt-4 rounded-md border border-accent/20 bg-accent/5 px-3 py-2 text-sm text-primary">
          {actionNotice}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table
          data-testid="finance-entry-list"
          className="min-w-full divide-y divide-gray-200 text-left text-sm"
        >
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
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
            {entries.map((entry) => {
              const isEditing = canManage && editingId === entry.id && draft;
              const isBusy = busyId === entry.id;

              if (isEditing) {
                return (
                  <tr key={entry.id} className="bg-accent/5">
                    <td className="px-4 py-3 text-gray-600">
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
                      <select
                        aria-label="Edit category"
                        value={draft.category}
                        onChange={(event) =>
                          setDraft({ ...draft, category: event.target.value })
                        }
                        className={editInputClassName}
                      >
                        {CATEGORY_OPTIONS.map((category) => (
                          <option key={category} value={category}>
                            {formatFinanceCategory(category)}
                          </option>
                        ))}
                      </select>
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
                    <td className="px-4 py-3 text-gray-400">—</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEdit(entry.id)}
                          disabled={isBusy}
                          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isBusy}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
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
                  <td className="px-4 py-3 text-gray-600">
                    {formatEventDateTime(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 capitalize text-primary">
                    {entry.entry_type}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatFinanceCategory(entry.category)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      entry.entry_type === "income"
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {formatCurrency(entry.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
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
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          disabled={isBusy || editingId !== null}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-primary transition hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(entry)}
                          disabled={isBusy || editingId !== null}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No transactions logged for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
