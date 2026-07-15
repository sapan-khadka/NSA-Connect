/**
 * Member Quick View — GitHub / Linear / Slack-style preview drawer.
 * Opens from the directory without changing the URL.
 * Shows only MemberResponse + optional dues; never invents metrics.
 */

import {
  Banknote,
  CalendarCheck2,
  GraduationCap,
  ListTodo,
  Mail,
  Pencil,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { Drawer } from "../design-system/components/feedback/Drawer";
import type { MemberResponse } from "../lib/auth-api";
import type { DuesStatus, MemberDuesRecord } from "../lib/dues-api";
import { formatCurrency } from "../lib/format-currency";
import { memberMailtoHref } from "../lib/member-mailto";
import { formatOutstandingDuesCell } from "../lib/members-directory";
import {
  formatPositionLabel,
  getRoleBadgeClassName,
  isMemberRole,
  type MemberRole,
} from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const MISSING = "—";

export type MemberQuickViewActivityItem = {
  id: string;
  label: string;
  detail?: string;
  occurredAtLabel?: string;
};

type MemberQuickViewDrawerProps = {
  member: MemberResponse | null;
  open: boolean;
  onClose: () => void;
  /** Real dues row from finance API when available. */
  duesRecord?: MemberDuesRecord | null;
  /**
   * Real activity events when a caller has them.
   * Omitted / empty → elegant empty state (no invented timeline).
   */
  activityItems?: MemberQuickViewActivityItem[];
  /** When set (board+), shows an enabled Edit Member action. */
  onEditMember?: (member: MemberResponse) => void;
};

type QuickStat = {
  label: string;
  value: ReactNode;
  icon: typeof Banknote;
  muted?: boolean;
};

function formatOutstandingDues(record: MemberDuesRecord | null | undefined): {
  label: string;
  muted: boolean;
  toneClass?: string;
} {
  if (!record) {
    return { label: MISSING, muted: true };
  }

  const status = record.status as DuesStatus;
  if (status === "paid" || status === "exempt") {
    return {
      label: "Paid",
      muted: false,
      toneClass: "members-quick-view-dues--paid",
    };
  }

  const outstanding = formatOutstandingDuesCell(record);
  const label =
    outstanding !== null ? formatCurrency(outstanding) : formatCurrency(0);

  if (status === "partial") {
    return {
      label,
      muted: false,
      toneClass: "members-quick-view-dues--partial",
    };
  }

  return {
    label,
    muted: false,
    toneClass: "members-quick-view-dues--overdue",
  };
}

function QuickViewStatusPill({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();
  const map: Record<
    string,
    { label: string; tone: "active" | "pending" | "alumni" | "inactive" }
  > = {
    approved: { label: "Active", tone: "active" },
    pending: { label: "Pending", tone: "pending" },
    alumni: { label: "Alumni", tone: "alumni" },
    inactive: { label: "Inactive", tone: "inactive" },
    rejected: { label: "Inactive", tone: "inactive" },
  };

  const resolved = map[normalized] ?? {
    label: status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : MISSING,
    tone: "alumni" as const,
  };

  return (
    <span
      className={`members-table-status-pill members-table-status-pill--${resolved.tone}`}
    >
      <span className="members-table-status-dot" aria-hidden="true" />
      {resolved.label}
    </span>
  );
}

function QuickViewRoleBadge({
  role,
  position,
}: {
  role: string;
  position: MemberResponse["position"];
}) {
  if (!role) {
    return <span className="members-quick-view-value is-muted">{MISSING}</span>;
  }

  const memberRole: MemberRole = isMemberRole(role) ? role : "general";
  const label = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const title =
    position !== "member"
      ? `${label} · ${formatPositionLabel(position)}`
      : label;

  return (
    <span className={getRoleBadgeClassName(memberRole, "sm")} title={title}>
      {label}
    </span>
  );
}

function QuickStatRow({ label, value, icon, muted }: QuickStat) {
  return (
    <div className="members-quick-view-metric">
      <span className="members-quick-view-metric-icon" aria-hidden="true">
        <AppIcon icon={icon} size="xs" className="text-current" />
      </span>
      <div className="members-quick-view-metric-copy">
        <dt className="members-quick-view-label">{label}</dt>
        <dd
          className={
            muted
              ? "members-quick-view-value is-muted"
              : "members-quick-view-value"
          }
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

export function MemberQuickViewDrawer({
  member,
  open,
  onClose,
  duesRecord = null,
  activityItems = [],
  onEditMember,
}: MemberQuickViewDrawerProps) {
  const navigate = useNavigate();

  if (!member || !open) {
    return null;
  }

  const profilePath = `/members/${member.id}`;
  const dues = formatOutstandingDues(duesRecord);
  const hasActivity = activityItems.length > 0;
  const mailtoHref = memberMailtoHref(member.email);

  const stats: QuickStat[] = [
    {
      label: "Attendance",
      value: MISSING,
      icon: CalendarCheck2,
      muted: true,
    },
    {
      label: "Outstanding Dues",
      value: (
        <span className={dues.toneClass ?? undefined}>{dues.label}</span>
      ),
      icon: Banknote,
      muted: dues.muted,
    },
    {
      label: "Active Tasks",
      value: MISSING,
      icon: ListTodo,
      muted: true,
    },
    {
      label: "Committee",
      value: MISSING,
      icon: UsersRound,
      muted: true,
    },
    {
      label: "Graduation Year",
      value: member.graduation_year ? String(member.graduation_year) : MISSING,
      icon: GraduationCap,
      muted: !member.graduation_year,
    },
  ];

  function goToProfile() {
    onClose();
    navigate(profilePath);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="md"
      closeOnBackdrop
      showClose
      className="members-quick-view-drawer"
      title={
        <span className="members-quick-view-title-block">
          <span className="members-quick-view-title-row">
            <Avatar
              name={member.full_name}
              size="lg"
              className="members-quick-view-avatar"
              aria-hidden="true"
            />
            <span className="members-quick-view-title-copy">
              <span className="members-quick-view-title-name">
                {member.full_name}
              </span>
              {member.email?.trim() ? (
                <span className="members-quick-view-title-email">
                  {member.email.trim()}
                </span>
              ) : null}
            </span>
          </span>
          <span className="members-quick-view-title-badges">
            <QuickViewRoleBadge
              role={member.role}
              position={member.position}
            />
            <QuickViewStatusPill status={member.status} />
          </span>
        </span>
      }
      footer={
        <div className="members-quick-view-footer">
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="members-quick-view-footer-primary"
            onClick={goToProfile}
          >
            <AppIcon icon={UserRound} size="xs" className="text-current" />
            View Full Profile
          </Button>
          {onEditMember ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Edit Member"
              onClick={() => onEditMember(member)}
            >
              <AppIcon icon={Pencil} size="xs" className="text-current" />
              Edit Member
            </Button>
          ) : null}
          {mailtoHref ? (
            <a
              href={mailtoHref}
              className="members-quick-view-mailto inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-surface-card px-3 py-1.5 text-sm font-medium text-foreground transition duration-200 ease-out hover:border-primary/40 hover:bg-badge-teal-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
              aria-label={`Send Message to ${member.full_name}`}
            >
              <AppIcon icon={Mail} size="xs" className="text-current" />
              Send Message
            </a>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="No email on file"
              aria-label="Send Message (No email on file)"
            >
              <AppIcon icon={Mail} size="xs" className="text-current" />
              Send Message
            </Button>
          )}
        </div>
      }
    >
      <div className="members-quick-view">
        <section aria-labelledby="members-quick-view-stats-heading">
          <h3
            id="members-quick-view-stats-heading"
            className="members-quick-view-section-title"
          >
            Quick Stats
          </h3>
          <dl className="members-quick-view-metrics" aria-label="Quick stats">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="members-quick-view-metric-wrap"
                style={{ ["--qv-stagger" as string]: String(index) }}
              >
                <QuickStatRow {...stat} />
              </div>
            ))}
          </dl>
        </section>

        <section
          className="members-quick-view-activity"
          aria-labelledby="members-quick-view-recent-heading"
        >
          <h3
            id="members-quick-view-recent-heading"
            className="members-quick-view-section-title"
          >
            Recent Activity
          </h3>
          {hasActivity ? (
            <ul className="members-quick-view-activity-list">
              {activityItems.map((item) => (
                <li key={item.id} className="members-quick-view-activity-item">
                  <div className="min-w-0">
                    <p className="members-quick-view-activity-label">
                      {item.label}
                    </p>
                    {item.detail ? (
                      <p className="members-quick-view-activity-detail">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                  {item.occurredAtLabel ? (
                    <time className="members-quick-view-activity-time">
                      {item.occurredAtLabel}
                    </time>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="members-quick-view-activity-empty">
              <p className="members-quick-view-activity-empty-title">
                No recent activity yet.
              </p>
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
