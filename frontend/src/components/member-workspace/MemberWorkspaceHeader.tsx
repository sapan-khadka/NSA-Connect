/**
 * Member Workspace Hero — GitHub / Linear / Slack-style member overview.
 * Answers “Who is this member?” using only real MemberResponse fields.
 */

import {
  CalendarPlus,
  ChevronLeft,
  GraduationCap,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import { Avatar } from "../../design-system/components/Avatar";
import { useAuth } from "../../context/useAuth";
import type { MemberResponse } from "../../lib/auth-api";
import { memberMailtoHref } from "../../lib/member-mailto";
import { canViewMemberDirectory } from "../../lib/roles";
import { EditMemberDrawer } from "../EditMemberDrawer";
import { RoleBadge } from "../RoleBadge";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";

const MISSING = "—";

type MemberWorkspaceHeaderProps = {
  member: MemberResponse;
  /** Optional committee label from a real source only — omit when unknown. */
  committee?: string | null;
  /** Optional joined date label from a real source only — omit → "—". */
  joinedAtLabel?: string | null;
  backTo?: string;
  backLabel?: string;
  /** Keep parent workspace profile in sync after Edit Member saves. */
  onMemberUpdated?: (member: MemberResponse) => void;
};

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : MISSING;
}

function MemberStatusPill({ status }: { status: string }) {
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

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  const missing = value === MISSING;
  return (
    <div className="member-workspace-meta-item">
      <span className="member-workspace-meta-icon" aria-hidden="true">
        <AppIcon icon={icon} size="xs" className="text-current" />
      </span>
      <div className="member-workspace-meta-copy">
        <dt className="member-workspace-meta-label">{label}</dt>
        <dd
          className={
            missing
              ? "member-workspace-meta-value is-missing"
              : "member-workspace-meta-value"
          }
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

export function MemberWorkspaceHeader({
  member,
  committee = null,
  joinedAtLabel = null,
  backTo = "/members",
  backLabel = "Back to Members",
  onMemberUpdated,
}: MemberWorkspaceHeaderProps) {
  const { member: currentMember } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const committeeLabel = committee?.trim() || null;
  const graduationLabel = member.graduation_year
    ? String(member.graduation_year)
    : MISSING;
  const mailtoHref = memberMailtoHref(member.email);
  const canEdit = Boolean(
    currentMember && canViewMemberDirectory(currentMember.role),
  );

  return (
    <div className="member-workspace-header-inner">
      <div className="member-workspace-hero-top">
        <Link to={backTo} className="member-workspace-back">
          <AppIcon icon={ChevronLeft} size="sm" className="text-current" />
          {backLabel}
        </Link>

        <div
          className="member-workspace-hero-actions"
          role="group"
          aria-label="Member actions"
        >
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Edit Member"
              onClick={() => setEditOpen(true)}
            >
              <AppIcon icon={Pencil} size="xs" className="text-current" />
              <span className="member-workspace-action-label">Edit Member</span>
            </Button>
          ) : null}
          {mailtoHref ? (
            <a
              href={mailtoHref}
              className="member-workspace-mailto inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-surface-card px-3 py-1.5 text-sm font-medium text-foreground transition duration-200 ease-out hover:border-primary/40 hover:bg-badge-teal-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
              aria-label={`Message ${member.full_name}`}
            >
              <AppIcon icon={Mail} size="xs" className="text-current" />
              <span className="member-workspace-action-label">Message</span>
            </a>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="No email on file"
              aria-label="Message (No email on file)"
            >
              <AppIcon icon={Mail} size="xs" className="text-current" />
              <span className="member-workspace-action-label">Message</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="member-workspace-more-btn"
            disabled
            title="Coming Soon"
            aria-label="More actions (Coming Soon)"
          >
            <AppIcon icon={MoreHorizontal} size="sm" className="text-current" />
          </Button>
        </div>
      </div>

      <div className="member-workspace-header-main">
        <Avatar
          name={member.full_name}
          size="xl"
          className="member-workspace-avatar"
        />

        <div className="member-workspace-header-copy">
          <h1 className="member-workspace-name">{member.full_name}</h1>

          <div className="member-workspace-badges">
            <RoleBadge role={member.role} size="sm" />
            <MemberStatusPill status={member.status} />
            {committeeLabel ? (
              <span className="member-workspace-committee-badge">
                {committeeLabel}
              </span>
            ) : null}
          </div>

          <dl className="member-workspace-meta" aria-label="Member details">
            <MetaItem
              icon={Mail}
              label="Email"
              value={displayValue(member.email)}
            />
            <MetaItem
              icon={Phone}
              label="Phone"
              value={displayValue(member.phone)}
            />
            <MetaItem
              icon={GraduationCap}
              label="Graduation Year"
              value={graduationLabel}
            />
            <MetaItem
              icon={CalendarPlus}
              label="Joined Organization"
              value={displayValue(joinedAtLabel)}
            />
          </dl>
        </div>
      </div>

      {canEdit ? (
        <EditMemberDrawer
          member={member}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onMemberUpdated={(updated) => {
            onMemberUpdated?.(updated);
          }}
        />
      ) : null}
    </div>
  );
}
