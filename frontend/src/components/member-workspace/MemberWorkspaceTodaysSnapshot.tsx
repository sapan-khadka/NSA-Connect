/**
 * Today's Snapshot — compact executive summary chips under the member header.
 */

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarCheck2,
  ClipboardList,
  GraduationCap,
  Shield,
  Wallet,
} from "lucide-react";

import type { MemberWorkspaceSnapshotChip } from "../../lib/member-workspace-snapshot";
import { AppIcon } from "../ui/AppIcon";

const CHIP_ICONS: Record<MemberWorkspaceSnapshotChip["id"], LucideIcon> = {
  active_status: BadgeCheck,
  dues_status: Wallet,
  next_event_rsvp: CalendarCheck2,
  open_tasks: ClipboardList,
  board_role: Shield,
  graduation_year: GraduationCap,
};

type MemberWorkspaceTodaysSnapshotProps = {
  chips: MemberWorkspaceSnapshotChip[];
};

export function MemberWorkspaceTodaysSnapshot({
  chips,
}: MemberWorkspaceTodaysSnapshotProps) {
  return (
    <section
      className="member-workspace-snapshot"
      aria-label="Today's Snapshot"
    >
      <h2 className="member-workspace-snapshot-title">Today&apos;s Snapshot</h2>
      <ul className="member-workspace-snapshot-chips">
        {chips.map((chip) => (
          <li key={chip.id} className="member-workspace-snapshot-chip">
            <span
              className="member-workspace-snapshot-chip-icon"
              aria-hidden="true"
            >
              <AppIcon
                icon={CHIP_ICONS[chip.id]}
                size="xs"
                className="text-current"
              />
            </span>
            <div className="member-workspace-snapshot-chip-copy">
              <span className="member-workspace-snapshot-chip-label">
                {chip.label}
              </span>
              <span
                className={
                  chip.muted
                    ? "member-workspace-snapshot-chip-value is-muted"
                    : "member-workspace-snapshot-chip-value"
                }
              >
                {chip.value}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
