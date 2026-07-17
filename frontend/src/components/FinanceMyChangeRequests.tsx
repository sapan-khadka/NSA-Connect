import { useCallback, useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchMyFinanceChangeRequests,
  type FinanceChangeRequestResponse,
} from "../lib/finance-api";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";
import { Card } from "./ui/Card";

type FinanceMyChangeRequestsProps = {
  refreshKey?: number;
};

function statusLabel(status: FinanceChangeRequestResponse["status"]): string {
  if (status === "pending") {
    return "Pending approval";
  }
  if (status === "approved") {
    return "Approved";
  }
  return "Rejected";
}

function statusClass(status: FinanceChangeRequestResponse["status"]): string {
  if (status === "pending") {
    return "bg-surface-muted text-label";
  }
  if (status === "approved") {
    return "bg-accent/10 text-foreground";
  }
  return "border border-urgent/30 bg-urgent/5 text-foreground";
}

export function FinanceMyChangeRequests({
  refreshKey = 0,
}: FinanceMyChangeRequestsProps) {
  const [requests, setRequests] = useState<FinanceChangeRequestResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchMyFinanceChangeRequests();
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

  if (isLoading) {
    return (
      <Card padding="md">
        <p className="text-sm text-label">Loading your finance requests…</p>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <h2 className="text-base font-medium text-foreground">
        Your finance requests
      </h2>

      {error ? <p className="mt-3 ds-field-error">{error}</p> : null}

      {requests.length === 0 ? (
        <p className="mt-4 text-sm text-label">No submitted change requests yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.map((request) => {
            const amountLabel =
              request.entry_amount != null
                ? formatCurrency(request.entry_amount)
                : "—";
            return (
              <Card
                key={request.id}
                as="li"
                nested
                padding="sm"
                className="rounded-md"
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
                      Submitted {formatEventDateTime(request.created_at)}
                    </p>
                    {request.reviewed_at ? (
                      <p className="mt-1 text-xs text-label">
                        Reviewed{" "}
                        {request.reviewed_by_name
                          ? `by ${request.reviewed_by_name} `
                          : ""}
                        · {formatEventDateTime(request.reviewed_at)}
                      </p>
                    ) : null}
                    {request.review_note ? (
                      <p className="mt-2 text-sm text-foreground">
                        Note: {request.review_note}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(request.status)}`}
                  >
                    {statusLabel(request.status)}
                  </span>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
