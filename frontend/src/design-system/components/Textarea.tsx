import {
  forwardRef,
  useId,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cx } from "../cx";
import {
  fieldControlClassName,
  fieldControlErrorClassName,
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from "./fieldStyles";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
};

/**
 * Multi-line text field with optional label, hint, and error states.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, error, hint, id, className = "", ...rest },
    ref,
  ) {
    const generatedId = useId();
    const areaId = id ?? rest.name ?? generatedId;
    const errorId = `${areaId}-error`;
    const hintId = `${areaId}-hint`;
    const describedBy = [
      error ? errorId : null,
      !error && hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={areaId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            fieldControlClassName,
            "mt-1 min-h-24 resize-y",
            label ? "" : "mt-0",
            error ? fieldControlErrorClassName : "",
            className,
          )}
          {...rest}
        />
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
