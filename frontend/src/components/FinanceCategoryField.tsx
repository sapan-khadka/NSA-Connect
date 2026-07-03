import {
  CUSTOM_FINANCE_CATEGORY,
  formatFinanceCategory,
} from "../lib/finance-categories";
import { FINANCE_CATEGORIES } from "../lib/finance-form";

type FinanceCategoryFieldProps = {
  id: string;
  category: string;
  customCategory: string;
  categoryError?: string;
  customCategoryError?: string;
  onCategoryChange: (category: string) => void;
  onCustomCategoryChange: (value: string) => void;
  inputClassName: string;
  labelClassName: string;
};

export function FinanceCategoryField({
  id,
  category,
  customCategory,
  categoryError,
  customCategoryError,
  onCategoryChange,
  onCustomCategoryChange,
  inputClassName,
  labelClassName,
}: FinanceCategoryFieldProps) {
  const showCustomInput = category === CUSTOM_FINANCE_CATEGORY;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={id} className={labelClassName}>
          Category
        </label>
        <select
          id={id}
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className={inputClassName}
        >
          {FINANCE_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {formatFinanceCategory(option)}
            </option>
          ))}
          <option value={CUSTOM_FINANCE_CATEGORY}>Add your own…</option>
        </select>
        {categoryError ? (
          <p className="mt-1 ds-field-error">{categoryError}</p>
        ) : null}
      </div>

      {showCustomInput ? (
        <div>
          <label htmlFor={`${id}-custom`} className={labelClassName}>
            Custom category
          </label>
          <input
            id={`${id}-custom`}
            type="text"
            value={customCategory}
            placeholder="e.g. Equipment rental"
            onChange={(event) => onCustomCategoryChange(event.target.value)}
            className={inputClassName}
          />
          {customCategoryError ? (
            <p className="mt-1 ds-field-error">{customCategoryError}</p>
          ) : (
            <p className="mt-1 text-xs font-light text-label">
              Use a specific label so spending is easy to track later.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
