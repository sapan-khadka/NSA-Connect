import { duesStatusLabel, duesStatusToneClass, paymentMethodLabel } from "../lib/dues";
import { formatCurrency } from "../lib/format-currency";
import { formatEventDateTime } from "../lib/format-datetime";
import {
  computeMemberPaymentsSummary,
  paymentHistoryTitle,
  type MemberPaymentRecord,
  type MemberPaymentsSummary,
} from "../lib/member-payments";

type MemberPaymentsPanelProps = {
  records?: MemberPaymentRecord[];
  summary?: MemberPaymentsSummary;
  currentSemester?: string;
};

export function MemberPaymentsPanel({
  records = [],
  summary: summaryProp,
  currentSemester,
}: MemberPaymentsPanelProps) {
  const summary =
    summaryProp ??
    computeMemberPaymentsSummary(records, currentSemester);

  return (
    <div className="member-payments">
      <div className="member-payments-hero">
        <div className="member-payments-balance">
          <p className="member-profile-eyebrow">Current balance</p>
          <p
            className={`member-payments-balance-value tabular-nums ${
              summary.currentBalance > 0
                ? "member-payments-balance-value--due"
                : "member-payments-balance-value--clear"
            }`}
          >
            {formatCurrency(summary.currentBalance)}
          </p>
        </div>

        <div className="member-payments-status-block">
          <p className="member-profile-eyebrow">Payment status</p>
          {summary.paymentStatus ? (
            <span
              className={`member-payments-badge inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${duesStatusToneClass(summary.paymentStatus)}`}
            >
              {summary.paymentStatusLabel}
            </span>
          ) : (
            <span className="member-payments-badge member-payments-badge--muted">
              {summary.paymentStatusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="member-payments-metrics">
        <div className="member-payments-metric">
          <span className="member-payments-metric-label">
            Outstanding amount
          </span>
          <span
            className={`member-payments-metric-value tabular-nums ${
              summary.outstandingAmount > 0
                ? "text-overdue"
                : "text-foreground"
            }`}
          >
            {formatCurrency(summary.outstandingAmount)}
          </span>
        </div>
        <div className="member-payments-metric">
          <span className="member-payments-metric-label">Next due date</span>
          <span className="member-payments-metric-value">
            {summary.nextDueLabel}
          </span>
        </div>
      </div>

      <div className="member-payments-progress">
        <div className="member-payments-progress-header">
          <span className="member-profile-eyebrow">Payment progress</span>
          <span className="member-payments-progress-caption">
            {summary.hasRecords
              ? summary.progressPercent >= 100
                ? "Complete"
                : summary.progressPercent > 0
                  ? "In progress"
                  : "Not started"
              : "No dues yet"}
          </span>
        </div>
        <div
          className="member-payments-bar"
          role="progressbar"
          aria-valuenow={summary.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Payment progress"
        >
          <div
            className={`member-payments-bar-fill ${
              summary.progressPercent >= 100
                ? "member-payments-bar-fill--complete"
                : summary.progressPercent > 0
                  ? "member-payments-bar-fill--partial"
                  : ""
            }`}
            style={{ width: `${summary.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="member-payments-history">
        <p className="member-profile-eyebrow">Payment history</p>
        {summary.history.length > 0 ? (
          <ol className="member-payments-timeline">
            {summary.history.map((item, index) => (
              <li key={item.id} className="member-payments-timeline-item">
                <span
                  className={`member-payments-timeline-dot member-payments-timeline-dot--${item.status}`}
                  aria-hidden="true"
                />
                {index < summary.history.length - 1 ? (
                  <span
                    className="member-payments-timeline-line"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="member-payments-timeline-body">
                  <div className="member-payments-timeline-top">
                    <p className="member-payments-timeline-title">
                      {paymentHistoryTitle(item)}
                    </p>
                    <span
                      className={`member-payments-badge inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${duesStatusToneClass(item.status)}`}
                    >
                      {duesStatusLabel(item.status)}
                    </span>
                  </div>
                  <p className="member-payments-timeline-meta">
                    {formatCurrency(item.amountPaid)} of{" "}
                    {formatCurrency(item.amountOwed)}
                    {item.paymentMethod
                      ? ` · ${paymentMethodLabel(item.paymentMethod)}`
                      : ""}
                  </p>
                  {item.paidAt ? (
                    <p className="member-payments-timeline-date">
                      {formatEventDateTime(item.paidAt)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="member-profile-empty mt-2">
            Payment history will appear when dues are recorded.
          </p>
        )}
      </div>
    </div>
  );
}
