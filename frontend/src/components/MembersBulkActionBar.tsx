/**
 * Members bulk-selection toolbar.
 * Selection management only until bulk mutations have backends.
 */

import { CheckSquare, X } from "lucide-react";

import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

type MembersBulkActionBarProps = {
  selectedCount: number;
  /** True when every member on the current page is selected. */
  allVisibleSelected?: boolean;
  onClear: () => void;
  onSelectAll: () => void;
};

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
              <span>Clear</span>
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
