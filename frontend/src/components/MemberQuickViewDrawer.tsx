/**
 * Member Quick View — premium side drawer for fast in-page management.
 * Presentation only; no backend changes.
 */

import {
  Activity,
  Banknote,
  CalendarCheck2,
  HeartPulse,
  ListTodo,
  Mail,
  Pencil,
  Shield,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { Drawer } from "../design-system/components/feedback/Drawer";
import type { MemberResponse } from "../lib/auth-api";
import { placeholderMemberHealth } from "../lib/member-health";
import { formatPositionLabel } from "../lib/roles";
import { MemberHealthBadge } from "./MemberHealthBadge";
import { StatusBadge } from "./StatusBadge";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const MISSING = "—";

type MemberQuickViewDrawerProps = {
  member: MemberResponse | null;
  open: boolean;
  onClose: () => void;
};

type MetricItem = {
  label: string;
  value: string;
  icon: typeof Shield;
  muted?: boolean;
};

function formatRoleLabel(role: string): string {
  if (!role) {
    return MISSING;
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function MetricRow({ label, value, icon, muted }: MetricItem) {
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
}: MemberQuickViewDrawerProps) {
  const navigate = useNavigate();

  if (!member || !open) {
    return null;
  }

  const roleLabel = formatRoleLabel(member.role);
  const positionLabel =
    member.position !== "member"
      ? formatPositionLabel(member.position)
      : null;
  const profilePath = `/members/${member.id}`;
  const health = placeholderMemberHealth(member.id, member.role);
  const attendanceFactor = health.factors.find((f) => f.key === "attendance");
  const taskFactor = health.factors.find((f) => f.key === "taskCompletion");
  const paymentFactor = health.factors.find((f) => f.key === "paymentStatus");
  const activityFactor = health.factors.find((f) => f.key === "recentActivity");

  const metrics: MetricItem[] = [
    { label: "Role", value: roleLabel, icon: Shield },
    { label: "Committee", value: MISSING, icon: UsersRound, muted: true },
    {
      label: "Health Score",
      value: `${health.score} · ${health.bandLabel}`,
      icon: HeartPulse,
    },
    {
      label: "Attendance",
      value: attendanceFactor
        ? `${attendanceFactor.score}`
        : MISSING,
      icon: CalendarCheck2,
    },
    {
      label: "Task Completion",
      value: taskFactor ? `${taskFactor.score}` : MISSING,
      icon: ListTodo,
    },
    {
      label: "Payment Status",
      value: paymentFactor?.detail ?? MISSING,
      icon: Banknote,
      muted: !paymentFactor?.available,
    },
    {
      label: "Recent Activity",
      value: activityFactor ? `${activityFactor.score}` : MISSING,
      icon: Activity,
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
      title={member.full_name}
      description="Quick view — glance at key details without leaving the directory."
      className="members-quick-view-drawer"
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
            View Profile
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Coming soon"
            aria-label="Message (coming soon)"
          >
            <AppIcon icon={Mail} size="xs" className="text-current" />
            Message
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToProfile}
          >
            <AppIcon icon={Pencil} size="xs" className="text-current" />
            Edit
          </Button>
        </div>
      }
    >
      <div className="members-quick-view">
        <header className="members-quick-view-hero">
          <div className="members-quick-view-avatar-wrap">
            <Avatar name={member.full_name} size="xl" />
          </div>
          <div className="min-w-0 members-quick-view-hero-copy">
            <div className="members-quick-view-hero-top">
              <div className="min-w-0">
                <p className="members-quick-view-subtitle">
                  {roleLabel}
                  {positionLabel ? ` · ${positionLabel}` : ""}
                </p>
                {member.email?.trim() ? (
                  <p className="members-quick-view-email">{member.email.trim()}</p>
                ) : null}
              </div>
              <div className="members-quick-view-hero-badges">
                <StatusBadge status={member.status} />
                <MemberHealthBadge snapshot={health} />
              </div>
            </div>
          </div>
        </header>

        <dl className="members-quick-view-metrics" aria-label="Member overview">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className="members-quick-view-metric-wrap"
              style={{ ["--qv-stagger" as string]: String(index) }}
            >
              <MetricRow {...metric} />
            </div>
          ))}
        </dl>

        <section
          className="members-quick-view-activity"
          aria-labelledby="members-quick-view-activity-heading"
        >
          <h4
            id="members-quick-view-activity-heading"
            className="members-quick-view-section-title"
          >
            Suggestions
          </h4>
          <ul className="members-quick-view-suggestions">
            {health.suggestions.slice(0, 3).map((suggestion) => (
              <li key={suggestion.id}>{suggestion.text}</li>
            ))}
          </ul>
        </section>

        <section
          className="members-quick-view-activity"
          aria-labelledby="members-quick-view-recent-heading"
        >
          <h4
            id="members-quick-view-recent-heading"
            className="members-quick-view-section-title"
          >
            Recent Activity
          </h4>
          <div className="members-quick-view-activity-empty">
            <p className="members-quick-view-activity-empty-title">
              No recent activity
            </p>
            <p className="members-quick-view-activity-empty-desc">
              Attendance, tasks, and dues updates will show up here.
            </p>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
