/**
 * Members directory toolbar — search + Filters panel.
 * Roster chips / status stay on the page from `md` up; on small screens they
 * also appear inside this panel.
 */

import { Filter } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Drawer } from "../design-system/components/feedback/Drawer";
import { Search } from "../design-system/components/Search";
import { Select } from "../design-system/components/Select";
import {
  EMPTY_MEMBERS_DIRECTORY_FILTERS,
  type MembersDirectoryFilters,
} from "../lib/members-directory";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const EMPTY = "";

const GRADUATION_YEAR_OPTIONS = [
  { value: EMPTY, label: "All years" },
  ...[2026, 2027, 2028, 2029, 2030].map((year) => ({
    value: String(year),
    label: String(year),
  })),
];

const PAYMENT_STATUS_OPTIONS = [
  { value: EMPTY, label: "All payments" },
  { value: "paid", label: "Paid" },
  { value: "outstanding", label: "Outstanding" },
  { value: "overdue", label: "Overdue" },
];

const MEMBER_STATUS_OPTIONS = [
  { value: EMPTY, label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const ROLE_OPTIONS = [
  { value: EMPTY, label: "All" },
  { value: "leadership", label: "Leadership" },
  { value: "board", label: "Board" },
  { value: "general", label: "Members" },
];

export type MembersDirectoryFocus =
  | "people"
  | "active"
  | "idle"
  | "pending"
  | "dues";

type MembersFiltersToolbarProps = {
  values: MembersDirectoryFilters;
  onChange: (next: MembersDirectoryFilters) => void;
  focus: MembersDirectoryFocus;
  onFocusChange: (focus: MembersDirectoryFocus) => void;
  canReviewMembers?: boolean;
  canFetchDues?: boolean;
  /** Clears page-level focus chips when Reset is pressed. */
  onResetFocus?: () => void;
};

export function MembersFiltersToolbar({
  values,
  onChange,
  focus,
  onFocusChange,
  canReviewMembers = false,
  canFetchDues = false,
  onResetFocus,
}: MembersFiltersToolbarProps) {
  const drawerTitleId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const focusOptions = useMemo(() => {
    const options = [{ value: "people", label: "All" }];
    if (canReviewMembers) {
      options.push(
        { value: "active", label: "Active" },
        { value: "idle", label: "Idle" },
        { value: "pending", label: "Pending" },
      );
    }
    if (canFetchDues) {
      options.push({ value: "dues", label: "Outstanding dues" });
    }
    return options;
  }, [canFetchDues, canReviewMembers]);

  /** Badge counts only panel-only filters (not roster chips shown on-page). */
  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (values.graduationYear) count += 1;
    if (values.paymentStatus) count += 1;
    if (values.memberStatus) count += 1;
    return count;
  }, [values.graduationYear, values.memberStatus, values.paymentStatus]);

  const hasAnyFilter =
    values.search.trim().length > 0 ||
    Boolean(values.role) ||
    Boolean(values.graduationYear) ||
    Boolean(values.paymentStatus) ||
    Boolean(values.memberStatus) ||
    focus !== "people";

  function updateField<K extends keyof MembersDirectoryFilters>(
    key: K,
    next: MembersDirectoryFilters[K],
  ) {
    onChange({ ...values, [key]: next });
  }

  function resetFilters() {
    onChange({
      ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
    });
    onResetFocus?.();
  }

  return (
    <div className="members-crm-toolbar-primary">
      <div className="members-crm-filter-control">
        <Search
          id="members-directory-search"
          value={values.search}
          onChange={(event) => updateField("search", event.target.value)}
          placeholder="Search members…"
          aria-label="Search members"
          clearable
          onClear={() => updateField("search", EMPTY)}
          containerClassName="members-crm-search"
          inputClassName="members-crm-search-input"
        />
      </div>

      <button
        type="button"
        className={[
          "members-crm-filter-btn",
          advancedFilterCount > 0 || filtersOpen ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={filtersOpen}
        aria-haspopup="dialog"
        aria-label={
          advancedFilterCount > 0
            ? `Filters, ${advancedFilterCount} active`
            : "Filters"
        }
        onClick={() => setFiltersOpen(true)}
      >
        <AppIcon icon={Filter} size="xs" className="text-current" />
        <span className="members-crm-filter-btn-label">Filters</span>
        {advancedFilterCount > 0 ? (
          <span className="members-crm-filter-count" aria-hidden="true">
            {advancedFilterCount}
          </span>
        ) : null}
      </button>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="right"
        size="sm"
        title="Filters"
        description="Status, payment, and graduation year."
        className="members-filters-drawer"
        footer={
          <div className="members-filters-drawer-footer">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hasAnyFilter}
              onClick={resetFilters}
              aria-label="Reset Filters"
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setFiltersOpen(false)}
            >
              Done
            </Button>
          </div>
        }
      >
        <div
          className="members-filters-drawer-fields"
          role="group"
          aria-labelledby={drawerTitleId}
        >
          <span id={drawerTitleId} className="sr-only">
            Member filters
          </span>

          {/* Mobile-only: roster + focus live in page chips on md+ */}
          <div className="members-filters-drawer-mobile-block md:hidden">
            <Select
              id="members-filter-role"
              label="Roster"
              name="role"
              options={ROLE_OPTIONS}
              value={values.role}
              onChange={(event) => updateField("role", event.target.value)}
              className="members-filters-control"
            />
            <Select
              id="members-filter-focus"
              label="Status"
              name="focus"
              options={focusOptions}
              value={focus}
              onChange={(event) =>
                onFocusChange(event.target.value as MembersDirectoryFocus)
              }
              className="members-filters-control"
            />
          </div>

          <Select
            id="members-filter-member-status"
            label="Membership"
            name="memberStatus"
            options={MEMBER_STATUS_OPTIONS}
            value={values.memberStatus}
            onChange={(event) =>
              updateField("memberStatus", event.target.value)
            }
            className="members-filters-control"
          />
          <Select
            id="members-filter-payment-status"
            label="Payment"
            name="paymentStatus"
            options={PAYMENT_STATUS_OPTIONS}
            value={values.paymentStatus}
            onChange={(event) =>
              updateField("paymentStatus", event.target.value)
            }
            className="members-filters-control"
          />
          <Select
            id="members-filter-graduation-year"
            label="Graduation year"
            name="graduationYear"
            options={GRADUATION_YEAR_OPTIONS}
            value={values.graduationYear}
            onChange={(event) =>
              updateField("graduationYear", event.target.value)
            }
            className="members-filters-control"
          />
        </div>
      </Drawer>
    </div>
  );
}
