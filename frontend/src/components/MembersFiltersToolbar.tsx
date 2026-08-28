/**
 * Members directory toolbar — search + Filters panel.
 * Roster chips live on the page; engagement/payment/year live in the drawer.
 * On small screens, roster also appears in the drawer.
 */

import { Filter } from "lucide-react";
import { useId, useMemo } from "react";

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

const MOBILE_ROSTER_OPTIONS = [
  ...ROLE_OPTIONS,
  { value: "__archive__", label: "Archive (rejected)" },
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
  onOpenFilters: () => void;
  filtersOpen: boolean;
  advancedFilterCount: number;
};

export function MembersFiltersToolbar({
  values,
  onChange,
  onOpenFilters,
  filtersOpen,
  advancedFilterCount,
}: MembersFiltersToolbarProps) {
  function updateField<K extends keyof MembersDirectoryFilters>(
    key: K,
    next: MembersDirectoryFilters[K],
  ) {
    onChange({ ...values, [key]: next });
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
        onClick={onOpenFilters}
      >
        <AppIcon icon={Filter} size="xs" className="text-current" />
        <span className="members-crm-filter-btn-label">Filters</span>
        {advancedFilterCount > 0 ? (
          <span className="members-crm-filter-count" aria-hidden="true">
            {advancedFilterCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}

type MembersFiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  values: MembersDirectoryFilters;
  onChange: (next: MembersDirectoryFilters) => void;
  focus: MembersDirectoryFocus;
  onFocusChange: (focus: MembersDirectoryFocus) => void;
  canReviewMembers?: boolean;
  canFetchDues?: boolean;
  onResetFocus?: () => void;
};

export function MembersFiltersDrawer({
  open,
  onClose,
  values,
  onChange,
  focus,
  onFocusChange,
  canReviewMembers = false,
  canFetchDues = false,
  onResetFocus,
}: MembersFiltersDrawerProps) {
  const drawerTitleId = useId();

  const focusOptions = useMemo(() => {
    const options = [{ value: "people", label: "Everyone" }];
    if (canReviewMembers) {
      options.push(
        { value: "active", label: "Active" },
        { value: "idle", label: "Idle" },
      );
    }
    if (canFetchDues) {
      options.push({ value: "dues", label: "Outstanding dues" });
    }
    return options;
  }, [canFetchDues, canReviewMembers]);

  const drawerFocus =
    focus === "pending" || focus === "people" ? "people" : focus;

  const hasAnyFilter =
    values.search.trim().length > 0 ||
    Boolean(values.role) ||
    Boolean(values.graduationYear) ||
    Boolean(values.paymentStatus) ||
    Boolean(values.memberStatus) ||
    drawerFocus !== "people";

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
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="sm"
      title="Filters"
      description="Narrow the directory by engagement, membership, or payment."
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
          <Button type="button" variant="primary" size="sm" onClick={onClose}>
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

        <div className="members-filters-drawer-mobile-block md:hidden">
          <Select
            id="members-filter-role"
            label="Roster"
            name="role"
            options={MOBILE_ROSTER_OPTIONS}
            value={
              values.memberStatus === "rejected"
                ? "__archive__"
                : values.role
            }
            onChange={(event) => {
              const next = event.target.value;
              if (next === "__archive__") {
                onChange({
                  ...values,
                  role: EMPTY,
                  memberStatus: "rejected",
                });
                return;
              }
              onChange({
                ...values,
                role: next,
                memberStatus:
                  values.memberStatus === "rejected"
                    ? EMPTY
                    : values.memberStatus,
              });
            }}
            className="members-filters-control"
          />
        </div>

        {focusOptions.length > 1 ? (
          <Select
            id="members-filter-focus"
            label="Engagement"
            name="focus"
            options={focusOptions}
            value={drawerFocus}
            onChange={(event) =>
              onFocusChange(event.target.value as MembersDirectoryFocus)
            }
            className="members-filters-control"
          />
        ) : null}

        <Select
          id="members-filter-member-status"
          label="Membership"
          name="memberStatus"
          options={MEMBER_STATUS_OPTIONS}
          value={values.memberStatus}
          onChange={(event) => updateField("memberStatus", event.target.value)}
          className="members-filters-control"
        />
        <Select
          id="members-filter-payment-status"
          label="Payment"
          name="paymentStatus"
          options={PAYMENT_STATUS_OPTIONS}
          value={values.paymentStatus}
          onChange={(event) => updateField("paymentStatus", event.target.value)}
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
  );
}

/** Badge counts panel filters (not on-page roster chips). */
export function countMembersAdvancedFilters(
  values: MembersDirectoryFilters,
): number {
  let count = 0;
  if (values.graduationYear) count += 1;
  if (values.paymentStatus) count += 1;
  if (values.memberStatus) count += 1;
  return count;
}
