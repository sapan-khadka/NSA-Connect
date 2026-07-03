import { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  approveFinanceChangeRequest,
  fetchPendingFinanceChangeRequests,
  rejectFinanceChangeRequest,
  type FinanceChangeRequestResponse,
} from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";

type FinancePendingApprovalsProps = {
  refreshKey?: number;
  onChanged?: () => void;
};

export function FinancePendingApprovals({
  refreshKey = 0,
  onChanged,
}: FinancePendingApprovalsProps) {
  const [requests, setRequests] = useState<FinanceChangeRequestResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchPendingFinanceChangeRequests();
      setRequests(response.requests);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function handleApprove(requestId: number) {
    setBusyId(requestId);
    setError(null);
    try {
      await approveFinanceChangeRequest(requestId);
      setRequests((current) => current.filter((item) => item.id !== requestId));
      onChanged?.();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(requestId: number) {
    setBusyId(requestId);
    setError(null);
    try {
      await rejectFinanceChangeRequest(requestId);
      setRequests((current) => current.filter((item) => item.id !== requestId));
      onChanged?.();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <section className="ds-card p-6">
        <p className="text-sm text-label">Loading pending approvals…</p>
      </section>
    );
  }

  return (
    <section className="ds-card p-6">
      <h2 className="text-base font-medium text-foreground">Pending finance approvals</h2>

      {error ? <p className="mt-3 ds-field-error">{error}</p> : null}

      {requests.length === 0 ? (
        <p className="mt-4 text-sm text-label">No pending change requests.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.map((request) => {
            const isBusy = busyId === request.id;
            const amountLabel =
              request.entry_amount != null
                ? formatCurrency(request.entry_amount)
                : "—";
            return (
              <li
                key={request.id}
                className="rounded-md ds-card-nested p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {request.action === "delete" ? "Delete" : "Update"} request
                    </p>
                    <p className="mt-1 text-sm text-label">
                      {request.entry_description || "Finance entry"} · {amountLabel}
                    </p>
                    <p className="mt-1 text-xs text-label">
                      Requested by {request.requested_by_name} ·{" "}
                      {formatEventDateTime(request.created_at)}
                    </p>
                    {request.payload ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-foreground">
                        {JSON.stringify(request.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleApprove(request.id)}
                      className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleReject(request.id)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-gray-50 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
