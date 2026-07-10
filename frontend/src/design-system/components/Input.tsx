import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cx } from "../cx";
import {
  fieldControlClassName,
  fieldControlErrorClassName,
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from "./fieldStyles";
import { Spinner } from "./Spinner";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  /** Shows a trailing spinner; input remains usable unless also disabled. */
  loading?: boolean;
};

/**
 * Text input with optional label, hint, error, and loading states.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      hint,
      loading = false,
      id,
      className = "",
      disabled,
      ...rest
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? rest.name ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const describedBy = [
      error ? errorId : null,
      !error && hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <div className={cx("relative", label ? "mt-1" : "")}>
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-busy={loading || undefined}
            className={cx(
              fieldControlClassName,
              loading ? "pr-10" : "",
              error ? fieldControlErrorClassName : "",
              className,
            )}
            {...rest}
          />
          {loading ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <Spinner size="sm" label="Loading" />
            </span>
          ) : null}
        </div>
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
