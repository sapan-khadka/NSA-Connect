/**
 * Current Responsibilities — real assigned tasks for the Member Workspace.
 */

import { ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";

import type { MemberResponsibilityItem } from "../../lib/member-workspace-responsibilities";
import { AppIcon } from "../ui/AppIcon";

type MemberWorkspaceCurrentResponsibilitiesProps = {
  items: MemberResponsibilityItem[];
  isLoading?: boolean;
  viewAllPath: string;
  assignTaskPath: string | null;
};

function StatusBadge({
  status,
  label,
}: {
  status: MemberResponsibilityItem["status"];
  label: string;
}) {
  return (
    <span
      className={`member-workspace-resp-badge member-workspace-resp-badge--${status}`}
    >
      {label}
    </span>
  );
}

function ResponsibilitiesEmpty({
  assignTaskPath,
}: {
  assignTaskPath: string | null;
}) {
  return (
    <div className="member-workspace-resp-empty">
      <div className="member-workspace-resp-empty-art" aria-hidden="true">
        <svg
          viewBox="0 0 120 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="member-workspace-resp-empty-svg"
        >
          <rect
            x="18"
            y="14"
            width="84"
            height="52"
            rx="10"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.35"
          />
          <path
            d="M38 34h44M38 44h28"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.28"
          />
          <circle cx="88" cy="52" r="14" fill="currentColor" opacity="0.08" />
          <path
            d="M82 52h12M88 46v12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.4"
          />
        </svg>
      </div>
      <p className="member-workspace-resp-empty-title">
        No current responsibilities.
      </p>
      {assignTaskPath ? (
        <Link to={assignTaskPath} className="member-workspace-resp-assign-link">
          Assign a task
        </Link>
      ) : null}
    </div>
  );
}

function ResponsibilityRow({ item }: { item: MemberResponsibilityItem }) {
  return (
    <li>
      <Link
        to={item.detailPath}
        className="member-workspace-resp-item"
        aria-label={`Open ${item.title}`}
      >
        <div className="member-workspace-resp-item-top">
          <div className="min-w-0 flex-1">
            <p className="member-workspace-resp-title">{item.title}</p>
            {item.eventName ? (
              <p className="member-workspace-resp-event">{item.eventName}</p>
            ) : null}
          </div>
          <div className="member-workspace-resp-badges">
            <StatusBadge status={item.status} label={item.statusLabel} />
          </div>
        </div>

        <dl className="member-workspace-resp-meta">
          <div className="member-workspace-resp-meta-pair">
            <dt>Due</dt>
            <dd
              className={
                item.isOverdue
                  ? "member-workspace-resp-meta-value is-overdue"
                  : "member-workspace-resp-meta-value"
              }
            >
              {item.dueDateLabel ?? "—"}
            </dd>
          </div>
          <div className="member-workspace-resp-meta-pair">
            <dt>Assigned by</dt>
            <dd className="member-workspace-resp-meta-value is-muted">
              {item.assignedByLabel ?? "—"}
            </dd>
          </div>
          {item.progress ? (
            <div className="member-workspace-resp-meta-pair member-workspace-resp-meta-pair--wide">
              <dt>Progress</dt>
              <dd className="member-workspace-resp-meta-value">
                <span className="member-workspace-resp-progress-label">
                  {item.progress.completed}/{item.progress.total}
                </span>
                <span
                  className="member-workspace-resp-progress-track"
                  aria-hidden="true"
                >
                  <span
                    className="member-workspace-resp-progress-fill"
                    style={{ width: `${item.progress.percent}%` }}
                  />
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      </Link>
    </li>
  );
}

export function MemberWorkspaceCurrentResponsibilities({
  items,
  isLoading = false,
  viewAllPath,
  assignTaskPath,
}: MemberWorkspaceCurrentResponsibilitiesProps) {
  return (
    <section
      className="member-workspace-card member-workspace-card--default member-workspace-responsibilities"
      aria-label="Current Responsibilities"
    >
      <div className="member-workspace-card-header member-workspace-resp-header">
        <div className="member-workspace-card-heading">
          <span className="member-workspace-card-icon" aria-hidden="true">
            <AppIcon icon={ClipboardList} size="sm" className="text-current" />
          </span>
          <div className="min-w-0">
            <h2 className="member-workspace-card-title">
              Current Responsibilities
            </h2>
            <p className="member-workspace-card-desc">
              What this member is responsible for right now.
            </p>
          </div>
        </div>
        <Link to={viewAllPath} className="member-workspace-resp-view-all">
          View All
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      <div className="member-workspace-card-body member-workspace-resp-body">
        {isLoading ? (
          <p className="member-workspace-resp-loading">Loading responsibilities…</p>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <ResponsibilitiesEmpty assignTaskPath={assignTaskPath} />
        ) : null}

        {!isLoading && items.length > 0 ? (
          <ul className="member-workspace-resp-list">
            {items.map((item) => (
              <ResponsibilityRow key={item.id} item={item} />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
