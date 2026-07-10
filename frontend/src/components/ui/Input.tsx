import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cx } from "../../design-system/cx";

const FIELD_BASE =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-base text-foreground shadow-none transition duration-200 placeholder:text-label focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 sm:py-2 sm:text-sm";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
};

/**
 * CampusOS text input. Matches `.ds-field-input` visuals for drop-in adoption.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, error, hint, id, className = "", ...rest },
    ref,
  ) {
    const inputId = id ?? rest.name;

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cx(
            FIELD_BASE,
            error ? "border-overdue focus:border-overdue focus:ring-overdue/20" : "",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error && inputId ? `${inputId}-error` : undefined
          }
          {...rest}
        />
        {error ? (
          <p
            id={inputId ? `${inputId}-error` : undefined}
            className="ds-field-error mt-1 text-sm text-overdue"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {!error && hint ? (
          <p className="mt-1 text-sm text-label">{hint}</p>
        ) : null}
      </div>
    );
  },
);

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  error?: string | null;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, error, id, className = "", ...rest }, ref) {
    const areaId = id ?? rest.name;

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={areaId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={areaId}
          className={cx(
            FIELD_BASE,
            "min-h-24 resize-y",
            error ? "border-overdue focus:border-overdue focus:ring-overdue/20" : "",
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {error ? (
          <p className="ds-field-error mt-1 text-sm text-overdue" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

/** Class string for gradual migration of existing `inputClassName` constants. */
export const inputFieldClassName = FIELD_BASE;
