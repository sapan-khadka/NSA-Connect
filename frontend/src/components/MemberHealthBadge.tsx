/**
 * Compact Member Health chip for tables and quick views.
 */

import {
  memberHealthBandLabel,
  placeholderMemberHealth,
  type MemberHealthBand,
  type MemberHealthSnapshot,
} from "../lib/member-health";

type MemberHealthBadgeProps = {
  snapshot?: MemberHealthSnapshot;
  memberId?: number;
  role?: string;
  /** Show numeric score beside the band label. */
  showScore?: boolean;
};

export function MemberHealthBadge({
  snapshot: snapshotProp,
  memberId,
  role,
  showScore = false,
}: MemberHealthBadgeProps) {
  const snapshot =
    snapshotProp ?? placeholderMemberHealth(memberId, role);
  const band: MemberHealthBand = snapshot.band;
  const label = memberHealthBandLabel(band);
  const accessibleName = showScore
    ? `Member health: ${label}, score ${snapshot.score}`
    : `Member health: ${label}`;

  return (
    <span
      className={`member-health-badge member-health-badge--${band}`}
      role="status"
      aria-label={accessibleName}
      title={accessibleName}
    >
      {showScore ? (
        <span className="member-health-badge-score tabular-nums" aria-hidden="true">
          {snapshot.score}
        </span>
      ) : null}
      <span className="member-health-badge-label" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}
