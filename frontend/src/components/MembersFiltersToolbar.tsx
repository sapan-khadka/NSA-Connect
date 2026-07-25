/**
 * Members CRM Filter control — search + status/payment/year in a drawer.
 * Role filtering lives on the page chip row; this is the secondary Filter button.
 */

import { ChevronDown, Filter } from "lucide-react";
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

type MembersFiltersToolbarProps = {
  values: MembersDirectoryFilters;
  onChange: (next: MembersDirectoryFilters) => void;
  /** Extra active count from focus chips (active/idle/dues/pending). */
  focusActiveCount?: number;
  /** Clears page-level focus chips when Reset is pressed. */
  onResetFocus?: () => void;
};

export function MembersFiltersToolbar({
  values,
  onChange,
  focusActiveCount = 0,
  onResetFocus,
}: MembersFiltersToolbarProps) {
  const drawerTitleId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fieldFilterCount = useMemo(() => {
    let count = 0;
    if (values.search.trim()) count += 1;
    if (values.graduationYear) count += 1;
    if (values.paymentStatus) count += 1;
    if (values.memberStatus) count += 1;
    return count;
  }, [values]);

  const activeFilterCount = fieldFilterCount + focusActiveCount;

  const hasAnyFilter =
    values.search.trim().length > 0 ||
    Boolean(values.graduationYear) ||
    Boolean(values.paymentStatus) ||
    Boolean(values.memberStatus) ||
    focusActiveCount > 0;

  function updateField<K extends keyof MembersDirectoryFilters>(
    key: K,
    next: MembersDirectoryFilters[K],
  ) {
    onChange({ ...values, [key]: next });
  }

  function resetFilters() {
    onChange({
      ...EMPTY_MEMBERS_DIRECTORY_FILTERS,
      role: values.role,
    });
    onResetFocus?.();
  }

  return (
    <div className="members-crm-filter-control">
      <button
        type="button"
        className="members-crm-filter-btn"
        aria-expanded={filtersOpen}
        aria-haspopup="dialog"
        aria-label={
          activeFilterCount > 0
            ? `Filter, ${activeFilterCount} active`
            : "Filter"
        }
        onClick={() => setFiltersOpen(true)}
      >
        <AppIcon icon={Filter} size="xs" className="text-current" />
        <span>Filter</span>
        {activeFilterCount > 0 ? (
          <span className="members-crm-filter-count" aria-hidden="true">
            {activeFilterCount}
          </span>
        ) : null}
        <AppIcon icon={ChevronDown} size="xs" className="text-current opacity-70" />
      </button>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        side="bottom"
        title="Filter members"
        description="Search and narrow by status, payment, or graduation year."
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
          <Select
            id="members-filter-member-status"
            label="Member Status"
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
            label="Payment Status"
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
            label="Graduation Year"
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
