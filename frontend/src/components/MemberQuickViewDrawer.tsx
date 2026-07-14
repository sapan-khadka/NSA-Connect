/**
 * Member Quick View — side drawer for fast in-page management.
 * Presentation only; no backend changes.
 */

import { useNavigate } from "react-router-dom";

import { Avatar } from "../design-system/components/Avatar";
import { Drawer } from "../design-system/components/feedback/Drawer";
import type { MemberResponse } from "../lib/auth-api";
import { formatPositionLabel } from "../lib/roles";
import { Button } from "./ui/Button";

const MISSING = "—";

type MemberQuickViewDrawerProps = {
  member: MemberResponse | null;
  open: boolean;
  onClose: () => void;
};

function formatRoleLabel(role: string): string {
  if (!role) {
    return MISSING;
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="members-quick-view-row">
      <dt className="members-quick-view-label">{label}</dt>
      <dd className="members-quick-view-value">{value}</dd>
    </div>
  );
}

export function MemberQuickViewDrawer({
  member,
  open,
  onClose,
}: MemberQuickViewDrawerProps) {
  const navigate = useNavigate();

  if (!member) {
    return null;
  }

  const roleLabel = formatRoleLabel(member.role);
  const positionLabel =
    member.position !== "member"
      ? formatPositionLabel(member.position)
      : MISSING;
  const profilePath = `/members/${member.id}`;

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
      title="Member Quick View"
      description="Review key details without leaving the directory."
      className="members-quick-view-drawer"
      footer={
        <div className="members-quick-view-footer">
          <Button type="button" variant="primary" size="sm" onClick={goToProfile}>
            View Profile
          </Button>
          <Button type="button" variant="outline" size="sm" disabled>
            Message
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goToProfile}>
            Edit
          </Button>
        </div>
      }
    >
      <div className="members-quick-view">
        <div className="members-quick-view-hero">
          <Avatar name={member.full_name} size="xl" />
          <div className="min-w-0">
            <h3 className="members-quick-view-name">{member.full_name}</h3>
            <p className="members-quick-view-subtitle">
              {roleLabel}
              {positionLabel !== MISSING ? ` · ${positionLabel}` : ""}
            </p>
            {member.email?.trim() ? (
              <p className="members-quick-view-email">{member.email.trim()}</p>
            ) : null}
          </div>
        </div>

        <dl className="members-quick-view-details" aria-label="Member details">
          <DetailRow label="Name" value={member.full_name} />
          <DetailRow label="Role" value={roleLabel} />
          <DetailRow label="Committee" value={MISSING} />
          <DetailRow label="Attendance" value={MISSING} />
          <DetailRow label="Payment Status" value={MISSING} />
        </dl>

        <section
          className="members-quick-view-activity"
          aria-labelledby="members-quick-view-activity-heading"
        >
          <h4
            id="members-quick-view-activity-heading"
            className="members-quick-view-section-title"
          >
            Recent Activity
          </h4>
          <p className="member-profile-empty">
            No recent activity to show yet.
          </p>
        </section>
      </div>
    </Drawer>
  );
}
