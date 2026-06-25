import { useEffect, useState } from "react";
import axios from "axios";

import { formatFinanceCategory } from "../lib/finance-categories";
import {
  fetchFinanceEntries,
  type FinanceEntryResponse,
} from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";

type FinanceEntryListProps = {
  semester: string;
  refreshKey: number;
};

export function FinanceEntryList({ semester, refreshKey }: FinanceEntryListProps) {
  const [entries, setEntries] = useState<FinanceEntryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchFinanceEntries(
          semester === "all" ? undefined : { semester },
        );

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
  }, [semester, refreshKey]);

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

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Recent transactions</h2>
        <p className="mt-1 text-sm text-gray-500">
          Latest logged income and expense entries for the selected semester.
        </p>
      </div>

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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-gray-600">
                  {formatEventDateTime(entry.created_at)}
                </td>
                <td className="px-4 py-3 capitalize text-primary">{entry.entry_type}</td>
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
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
