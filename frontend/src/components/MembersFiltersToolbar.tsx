/**
 * Members page filter toolbar — Linear-style presentation.
 * Controlled from MembersPage so search/filters apply to the directory table.
 */

import { Filter } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Drawer } from "../design-system/components/feedback/Drawer";
import { Search } from "../design-system/components/Search";
import { Select } from "../design-system/components/Select";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  EMPTY_MEMBERS_DIRECTORY_FILTERS,
  type MembersDirectoryFilters,
} from "../lib/members-directory";
import { MEMBER_ROLES } from "../lib/roles";
import { AppIcon } from "./ui/AppIcon";
import { Button } from "./ui/Button";

const EMPTY = "";

const ROLE_OPTIONS = [
  { value: EMPTY, label: "All roles" },
  ...MEMBER_ROLES.map((role) => ({
    value: role,
    label: role.charAt(0).toUpperCase() + role.slice(1),
  })),
];

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

type FilterFieldsProps = {
  values: MembersDirectoryFilters;
  updateField: <K extends keyof MembersDirectoryFilters>(
    key: K,
    next: MembersDirectoryFilters[K],
  ) => void;
  hasAnyFilter: boolean;
  onReset: () => void;
  idPrefix?: string;
  showReset?: boolean;
};

function FilterFields({
  values,
  updateField,
  hasAnyFilter,
  onReset,
  idPrefix = "members-filter",
  showReset = true,
}: FilterFieldsProps) {
  return (
    <>
      <Select
        id={`${idPrefix}-role`}
        label="Role"
        name="role"
        options={ROLE_OPTIONS}
        value={values.role}
        onChange={(event) => updateField("role", event.target.value)}
        className="members-filters-control"
      />
      <Select
        id={`${idPrefix}-graduation-year`}
        label="Graduation Year"
        name="graduationYear"
        options={GRADUATION_YEAR_OPTIONS}
        value={values.graduationYear}
        onChange={(event) => updateField("graduationYear", event.target.value)}
        className="members-filters-control"
      />
      <Select
        id={`${idPrefix}-payment-status`}
        label="Payment Status"
        name="paymentStatus"
        options={PAYMENT_STATUS_OPTIONS}
        value={values.paymentStatus}
        onChange={(event) => updateField("paymentStatus", event.target.value)}
        className="members-filters-control"
      />
      <Select
        id={`${idPrefix}-member-status`}
        label="Member Status"
        name="memberStatus"
        options={MEMBER_STATUS_OPTIONS}
        value={values.memberStatus}
        onChange={(event) => updateField("memberStatus", event.target.value)}
        className="members-filters-control"
      />

      {showReset ? (
        <div className="members-filters-reset">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasAnyFilter}
            onClick={onReset}
            aria-label="Reset Filters"
          >
            Reset Filters
          </Button>
        </div>
      ) : null}
    </>
  );
}

type MembersFiltersToolbarProps = {
  values: MembersDirectoryFilters;
  onChange: (next: MembersDirectoryFilters) => void;
};

export function MembersFiltersToolbar({
  values,
  onChange,
}: MembersFiltersToolbarProps) {
  const drawerTitleId = useId();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (values.role) count += 1;
    if (values.graduationYear) count += 1;
    if (values.paymentStatus) count += 1;
    if (values.memberStatus) count += 1;
    return count;
  }, [values]);

  const hasAnyFilter =
    values.search.trim().length > 0 || activeFilterCount > 0;

  function updateField<K extends keyof MembersDirectoryFilters>(
    key: K,
    next: MembersDirectoryFilters[K],
  ) {
    onChange({ ...values, [key]: next });
  }

  function resetFilters() {
    onChange(EMPTY_MEMBERS_DIRECTORY_FILTERS);
  }

  const fieldProps: FilterFieldsProps = {
    values,
    updateField,
    hasAnyFilter,
    onReset: resetFilters,
  };

  return (
    <div
      className="members-filters-toolbar"
      role="search"
      aria-label="Search and filter members"
    >
      <div className="members-filters-toolbar-primary">
        <div className="members-filters-search">
          <Search
            id="members-filter-search"
            value={values.search}
            onChange={(event) => updateField("search", event.target.value)}
            placeholder="Search members…"
            aria-label="Search members"
            clearable
            onClear={() => updateField("search", EMPTY)}
            containerClassName="w-full"
            inputClassName="members-filters-search-input"
          />
        </div>

        {isMobile ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="members-filters-toggle"
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            aria-label={
              activeFilterCount > 0
                ? `Open filters, ${activeFilterCount} active`
                : "Open filters"
            }
            onClick={() => setFiltersOpen(true)}
          >
            <AppIcon icon={Filter} size="xs" className="text-current" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="members-filters-toggle-count" aria-hidden="true">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        ) : null}
      </div>

      {!isMobile ? (
        <div
          className="members-filters-panel"
          role="group"
          aria-label="Member filters"
        >
          <FilterFields {...fieldProps} />
        </div>
      ) : null}

      {isMobile ? (
        <Drawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          side="right"
          size="sm"
          title="Filters"
          description="Narrow the member directory."
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
                Reset Filters
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
            <FilterFields
              {...fieldProps}
              idPrefix="members-filter-mobile"
              showReset={false}
            />
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
