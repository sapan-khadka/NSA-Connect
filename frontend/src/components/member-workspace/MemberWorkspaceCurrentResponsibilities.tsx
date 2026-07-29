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
    <div className="member-workspace-empty-block">
      <p className="member-workspace-empty-inline">
        No current responsibilities.
      </p>
      {assignTaskPath ? (
        <Link to={assignTaskPath} className="member-workspace-empty-link">
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
          </div>
        </div>
        <Link to={viewAllPath} className="member-workspace-resp-view-all">
          View all
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
