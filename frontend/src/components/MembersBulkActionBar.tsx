/**
 * Floating bulk actions for selected members — UX only, no backend calls.
 */

import {
  Download,
  Mail,
  Shield,
  Trash2,
  UserMinus,
  UsersRound,
  X,
} from "lucide-react";

import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

type MembersBulkActionBarProps = {
  selectedCount: number;
  onClear: () => void;
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
    id: "deactivate",
    label: "Deactivate",
    icon: UserMinus,
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
  onClear,
}: MembersBulkActionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  const countLabel =
    selectedCount === 1 ? "1 member selected" : `${selectedCount} members selected`;

  return (
    <div
      className="members-bulk-bar"
      role="toolbar"
      aria-label="Bulk member actions"
    >
      <div className="members-bulk-bar-inner">
        <p className="members-bulk-bar-count" aria-live="polite">
          {countLabel}
        </p>

        <div className="members-bulk-bar-actions">
          {ACTIONS.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant={action.tone === "danger" ? "danger" : "ghost"}
              size="sm"
              className={
                action.tone === "warning"
                  ? "members-bulk-bar-action is-warning"
                  : action.tone === "danger"
                    ? "members-bulk-bar-action is-danger"
                    : "members-bulk-bar-action"
              }
              aria-label={`${action.label} ${selectedCount} selected member${selectedCount === 1 ? "" : "s"}`}
            >
              <AppIcon icon={action.icon} size="xs" className="text-current" />
              <span className="members-bulk-bar-action-label">
                {action.label}
              </span>
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="members-bulk-bar-dismiss"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <AppIcon icon={X} size="sm" className="text-current" />
        </Button>
      </div>
    </div>
  );
}
