import { useEffect, useState } from "react";

import { fetchMyDuesStatus, type MyDuesStatusResponse } from "../lib/dues-api";
import { formatMyDuesStatus } from "../lib/dues";
import { getCurrentSemesterSlug } from "../lib/semester";

type MemberDuesStatusProps = {
  className?: string;
};

export function MemberDuesStatus({ className = "" }: MemberDuesStatusProps) {
  const [status, setStatus] = useState<MyDuesStatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const semester = getCurrentSemesterSlug();

    async function loadStatus() {
      try {
        const response = await fetchMyDuesStatus(semester);
        if (!cancelled) {
          setStatus(response);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const label = status ? formatMyDuesStatus(status) : null;
  if (!label) {
    return null;
  }

  const isOutstanding =
    status?.status === "unpaid" || status?.status === "partial";

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        isOutstanding
          ? "border-overdue/30 bg-overdue-surface text-overdue"
          : "border-accent/20 bg-mint/20 text-accent"
      } ${className}`}
    >
      {label}
    </div>
  );
}
