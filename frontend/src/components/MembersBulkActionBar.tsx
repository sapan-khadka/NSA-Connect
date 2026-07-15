/**
 * Members bulk-selection toolbar — Gmail / GitHub / Linear style.
 * Presentation only: actions without backend support stay disabled.
 */

import {
  Archive,
  CheckSquare,
  Download,
  Mail,
  Shield,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";

import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

type MembersBulkActionBarProps = {
  selectedCount: number;
  /** True when every member on the current page is selected. */
  allVisibleSelected?: boolean;
  onClear: () => void;
  onSelectAll: () => void;
};

const ACTIONS = [
  { id: "email", label: "Email", icon: Mail, tone: "default" as const },
  {
    id: "assign-role",
    label: "Assign Role",
    icon: Shield,
    tone: "default" as const,
  },
  {
    id: "assign-committee",
    label: "Assign Committee",
    icon: UsersRound,
    tone: "default" as const,
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    tone: "default" as const,
  },
  {
    id: "archive",
    label: "Archive",
    icon: Archive,
    tone: "warning" as const,
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    tone: "danger" as const,
  },
] as const;

export function MembersBulkActionBar({
  selectedCount,
  allVisibleSelected = false,
  onClear,
  onSelectAll,
}: MembersBulkActionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  const countNoun = selectedCount === 1 ? "Member" : "Members";

  return (
    <div
      className="members-bulk-bar"
      role="toolbar"
      aria-label="Bulk member actions"
      aria-hidden={false}
    >
      <div className="members-bulk-bar-sheet">
        <div className="members-bulk-bar-grab" aria-hidden="true" />

        <div className="members-bulk-bar-inner">
          <div className="members-bulk-bar-count" aria-live="polite">
            <span className="members-bulk-bar-count-label">Selected</span>
            <span className="members-bulk-bar-count-value">
              {selectedCount} {countNoun}
            </span>
          </div>

          <div
            className="members-bulk-bar-actions"
            role="group"
            aria-label="Actions"
          >
            {ACTIONS.map((action) => {
              const showDivider =
                action.id === "archive" || action.id === "delete";

              return (
                <span key={action.id} className="members-bulk-bar-action-wrap">
                  {showDivider ? (
                    <span
                      className="members-bulk-bar-divider"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled
                    title="Coming Soon"
                    className={
                      action.tone === "danger"
                        ? "members-bulk-bar-action is-danger is-soon"
                        : action.tone === "warning"
                          ? "members-bulk-bar-action is-warning is-soon"
                          : "members-bulk-bar-action is-soon"
                    }
                    aria-label={`${action.label} (Coming Soon)`}
                  >
                    <AppIcon
                      icon={action.icon}
                      size="xs"
                      className="text-current"
                    />
                    <span className="members-bulk-bar-action-label">
                      {action.label}
                    </span>
                  </Button>
                </span>
              );
            })}
          </div>

          <div
            className="members-bulk-bar-meta"
            role="group"
            aria-label="Selection controls"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="members-bulk-bar-meta-btn"
              onClick={onClear}
              aria-label="Clear Selection"
            >
              <AppIcon icon={X} size="xs" className="text-current" />
              <span>Clear Selection</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="members-bulk-bar-meta-btn"
              onClick={onSelectAll}
              disabled={allVisibleSelected}
              aria-label={
                allVisibleSelected
                  ? "All visible members already selected"
                  : "Select All on this page"
              }
              title={
                allVisibleSelected
                  ? "All visible members are selected"
                  : "Select all on this page"
              }
            >
              <AppIcon icon={CheckSquare} size="xs" className="text-current" />
              <span>Select All</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
