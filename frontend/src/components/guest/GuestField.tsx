import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

import { AppIcon } from "../ui/AppIcon";

type GuestFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  icon?: LucideIcon;
  error?: string;
  hint?: ReactNode;
  action?: ReactNode;
};

export function GuestField({
  id,
  label,
  icon,
  error,
  hint,
  action,
  type = "text",
  ...rest
}: GuestFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;
  const describedBy = [
    error ? `${id}-error` : null,
    !error && hint ? `${id}-hint` : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="guest-field">
      <div className="guest-field-label-row">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      <div className={["guest-field-control", error ? "is-error" : ""].join(" ")}>
        {icon ? <AppIcon icon={icon} size="sm" className="guest-field-icon" /> : null}
        <input
          id={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className="guest-field-toggle"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <AppIcon icon={showPassword ? EyeOff : Eye} size="sm" />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="guest-field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={`${id}-hint`} className="guest-field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
