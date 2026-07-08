import { useEffect, useMemo, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
  DUES_PAYMENT_METHODS,
  DUES_STATUS_FILTERS,
  duesStatusLabel,
  duesStatusToneClass,
  paymentMethodLabel,
} from "../lib/dues";
import {
  fetchDuesDashboard,
  fetchSemesterDuesSettings,
  generateDuesRecords,
  markDuesPaid,
  markDuesUnpaid,
  updateMemberDues,
  upsertSemesterDuesSettings,
  type DuesDashboardResponse,
  type DuesPaymentMethod,
  type DuesStatus,
  type MemberDuesRecord,
} from "../lib/dues-api";
import { formatCurrency } from "../lib/format-currency";
import { formatSemesterLabel } from "../lib/semester";
import { Modal } from "./ui/Modal";

type DuesDashboardProps = {
  semester: string;
  refreshKey: number;
  onChanged: () => void;
};

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: DuesDashboardResponse }
  | { status: "error"; message: string };

type MarkPaidState = {
  record: MemberDuesRecord;
};

type EditAmountState = {
  record: MemberDuesRecord;
  amount: string;
};

const inputClassName =
  "w-full rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";

function SummaryMetric({
  title,
  value,
  caption,
  variant = "neutral",
}: {
  title: string;
  value: string;
  caption?: string;
  variant?: "neutral" | "positive" | "negative";
}) {
  const variantClass =
    variant === "negative"
      ? "border-overdue/20 bg-overdue-surface"
      : variant === "positive"
        ? "border-accent/20 bg-mint/25"
        : "border-gray-200 bg-surface-card";

  return (
    <div className={`rounded-card border p-4 shadow-card ${variantClass}`}>
      <p className="text-xs uppercase tracking-wide text-label">{title}</p>
      <p className="mt-2 text-2xl font-light tracking-headline text-foreground">{value}</p>
      {caption ? <p className="mt-1 text-xs text-label">{caption}</p> : null}
    </div>
  );
}

function MarkPaidModal({
  record,
  onClose,
  onSaved,
}: {
  record: MemberDuesRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<DuesPaymentMethod>("venmo");
  const [amountPaid, setAmountPaid] = useState(record.amount_owed);
  const [note, setNote] = useState(record.note ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await markDuesPaid(record.id, {
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        note: note.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Unable to mark dues as paid."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open={true} title={`Mark paid — ${record.member_name}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-label">
          Amount owed: {formatCurrency(record.amount_owed)}
        </p>

        <label className="block space-y-1 text-sm">
          <span className="text-label">Amount paid</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountPaid}
            onChange={(event) => setAmountPaid(event.target.value)}
            className={inputClassName}
            required
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-label">Payment method</span>
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as DuesPaymentMethod)}
            className={inputClassName}
          >
            {DUES_PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-label">Note (optional)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className={inputClassName}
          />
        </label>

        {error ? (
          <p className="text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm text-label hover:border-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Mark paid"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditAmountModal({
  record,
  onClose,
  onSaved,
}: {
  record: MemberDuesRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(record.amount_owed);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await updateMemberDues(record.id, { amount_owed: amount });
      onSaved();
      onClose();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Unable to update amount."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open={true} title={`Edit amount — ${record.member_name}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-label">
          Set to $0.00 to mark a member exempt for this semester.
        </p>

        <label className="block space-y-1 text-sm">
          <span className="text-label">Amount owed</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={inputClassName}
            required
          />
        </label>

        {error ? (
          <p className="text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm text-label hover:border-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save amount"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DuesDashboard({ semester, refreshKey, onChanged }: DuesDashboardProps) {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<"all" | DuesStatus>("all");
  const [search, setSearch] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [markPaidState, setMarkPaidState] = useState<MarkPaidState | null>(null);
  const [editAmountState, setEditAmountState] = useState<EditAmountState | null>(null);
  const [busyRecordId, setBusyRecordId] = useState<number | null>(null);

  const semesterLabel = formatSemesterLabel(semester);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setDashboardState({ status: "loading" });

      try {
        const [dashboard, settings] = await Promise.all([
          fetchDuesDashboard({
            semester,
            status: statusFilter === "all" ? undefined : statusFilter,
            search: search.trim() || undefined,
          }),
          fetchSemesterDuesSettings(semester),
        ]);

        if (!cancelled) {
          setDashboardState({ status: "ready", data: dashboard });
          if (settings) {
            setDefaultAmount(settings.default_amount);
          }
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDashboardState({
          status: "error",
          message: getApiErrorMessage(error, "Unable to load dues dashboard."),
        });
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [semester, statusFilter, search, refreshKey]);

  const summary = dashboardState.status === "ready" ? dashboardState.data.summary : null;
  const records = dashboardState.status === "ready" ? dashboardState.data.records : [];

  const paidSummaryLabel = useMemo(() => {
    if (!summary) {
      return "";
    }

    return `${summary.paid_count} of ${summary.member_count} paid`;
  }, [summary]);

  async function handleSaveDefault(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingDefault(true);
    setSettingsMessage(null);

    try {
      const settings = await upsertSemesterDuesSettings({
        semester,
        default_amount: defaultAmount,
      });
      setDefaultAmount(settings.default_amount);
      setSettingsMessage(`Default dues set to ${formatCurrency(settings.default_amount)} for ${semesterLabel}.`);
      onChanged();
    } catch (error) {
      setSettingsMessage(
        getApiErrorMessage(error, "Unable to save default amount."),
      );
    } finally {
      setIsSavingDefault(false);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setActionMessage(null);

    try {
      const result = await generateDuesRecords(semester);
      setActionMessage(
        `Created ${result.created_count} record${result.created_count === 1 ? "" : "s"} for ${semesterLabel}. Skipped ${result.skipped_count} existing.`,
      );
      onChanged();
    } catch (error) {
      setActionMessage(
        getApiErrorMessage(error, "Unable to generate dues records."),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleMarkUnpaid(record: MemberDuesRecord) {
    setBusyRecordId(record.id);
    setActionMessage(null);

    try {
      await markDuesUnpaid(record.id);
      onChanged();
    } catch (error) {
      setActionMessage(
        getApiErrorMessage(error, "Unable to mark dues unpaid."),
      );
    } finally {
      setBusyRecordId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-gray-200 bg-surface-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-light tracking-subhead text-foreground">
              Semester setup
            </h2>
            <p className="mt-1 text-sm text-label">
              Set the default amount, then generate unpaid records for all approved members.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {isGenerating ? "Generating…" : `Generate for ${semesterLabel}`}
          </button>
        </div>

        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => void handleSaveDefault(event)}
        >
          <label className="block min-w-[10rem] flex-1 space-y-1 text-sm">
            <span className="text-label">Default dues amount</span>
            <input
              type="text"
              inputMode="decimal"
              value={defaultAmount}
              onChange={(event) => setDefaultAmount(event.target.value)}
              placeholder="20.00"
              className={inputClassName}
            />
          </label>
          <button
            type="submit"
            disabled={isSavingDefault || !defaultAmount.trim()}
            className="rounded-full border border-gray-200 bg-surface-card px-4 py-2 text-sm text-foreground hover:border-accent disabled:opacity-60"
          >
            {isSavingDefault ? "Saving…" : "Save default"}
          </button>
        </form>

        {settingsMessage ? (
          <p className="mt-3 text-sm text-label">{settingsMessage}</p>
        ) : null}
        {actionMessage ? (
          <p className="mt-3 text-sm text-label" role="status">
            {actionMessage}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-label">
          Marking dues paid automatically logs a membership-dues income entry in Transactions — do not log the same payment again.
        </p>
      </section>

      {dashboardState.status === "loading" ? (
        <p className="text-sm text-label">Loading dues dashboard…</p>
      ) : null}

      {dashboardState.status === "error" ? (
        <p className="ds-alert-banner text-sm" role="alert">
          {dashboardState.message}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              title="Expected"
              value={formatCurrency(summary.total_expected)}
              caption={paidSummaryLabel}
            />
            <SummaryMetric
              title="Collected"
              value={formatCurrency(summary.total_collected)}
              variant="positive"
            />
            <SummaryMetric
              title="Outstanding"
              value={formatCurrency(summary.total_outstanding)}
              variant={summary.total_outstanding !== "0.00" && summary.total_outstanding !== "0" ? "negative" : "neutral"}
            />
            <SummaryMetric
              title="Status mix"
              value={`${summary.unpaid_count} unpaid`}
              caption={`${summary.partial_count} partial · ${summary.exempt_count} exempt`}
            />
          </div>

          <section className="rounded-card border border-gray-200 bg-surface-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or email"
                  aria-label="Search members"
                  className="min-w-[14rem] rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm text-foreground shadow-sm"
                />
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "all" | DuesStatus)
                  }
                  className="rounded-lg border border-gray-200 bg-surface-card px-3 py-2 text-sm text-foreground shadow-sm"
                >
                  {DUES_STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-label">
                {records.length} member{records.length === 1 ? "" : "s"} shown
              </p>
            </div>

            {records.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-label">
                No dues records match this filter. Generate records to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-label">
                    <tr>
                      <th className="px-4 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">Owed</th>
                      <th className="px-4 py-3 font-medium">Paid</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{record.member_name}</p>
                          <p className="text-xs text-label">{record.member_email}</p>
                        </td>
                        <td className="px-4 py-3">{formatCurrency(record.amount_owed)}</td>
                        <td className="px-4 py-3">{formatCurrency(record.amount_paid)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${duesStatusToneClass(record.status)}`}
                          >
                            {duesStatusLabel(record.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-label">
                          {paymentMethodLabel(record.payment_method)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {record.status !== "paid" && record.status !== "exempt" ? (
                              <button
                                type="button"
                                onClick={() => setMarkPaidState({ record })}
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs hover:border-accent"
                              >
                                Mark paid
                              </button>
                            ) : null}
                            {record.status === "paid" || record.status === "partial" ? (
                              <button
                                type="button"
                                disabled={busyRecordId === record.id}
                                onClick={() => void handleMarkUnpaid(record)}
                                className="rounded-full border border-gray-200 px-3 py-1 text-xs hover:border-accent disabled:opacity-60"
                              >
                                Mark unpaid
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                setEditAmountState({ record, amount: record.amount_owed })
                              }
                              className="rounded-full border border-gray-200 px-3 py-1 text-xs hover:border-accent"
                            >
                              Edit amount
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {markPaidState ? (
        <MarkPaidModal
          record={markPaidState.record}
          onClose={() => setMarkPaidState(null)}
          onSaved={onChanged}
        />
      ) : null}

      {editAmountState ? (
        <EditAmountModal
          record={editAmountState.record}
          onClose={() => setEditAmountState(null)}
          onSaved={onChanged}
        />
      ) : null}
    </div>
  );
}
