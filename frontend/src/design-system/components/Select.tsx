import {
  forwardRef,
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

import { cx } from "../cx";
import {
  fieldControlClassName,
  fieldControlErrorClassName,
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from "./fieldStyles";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
};

/**
 * Native select with CampusOS field styling and accessible error messaging.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      error,
      hint,
      options,
      placeholder,
      id,
      className = "",
      ...rest
    },
    ref,
  ) {
    const generatedId = useId();
    const selectId = id ?? rest.name ?? generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;
    const describedBy = [
      error ? errorId : null,
      !error && hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={selectId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            fieldControlClassName,
            "mt-1 appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10",
            label ? "" : "mt-0",
            error ? fieldControlErrorClassName : "",
            className,
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748B'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
          }}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled={rest.required}>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {error ? (
          <p id={errorId} className={fieldErrorClassName} role="alert">
            {error}
          </p>
        ) : null}
        {!error && hint ? (
          <p id={hintId} className={fieldHintClassName}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
