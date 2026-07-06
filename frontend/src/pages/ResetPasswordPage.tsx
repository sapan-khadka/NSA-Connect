import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
  confirmPasswordReset,
  getApiErrorMessage,
} from "../lib/auth-api";
import {
  getPasswordHint,
  validateRegisterPassword,
} from "../lib/validation";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPasswordError = validateRegisterPassword(password);
    const nextConfirmError =
      password !== confirmPassword ? "Passwords do not match" : null;

    setPasswordError(nextPasswordError ?? undefined);
    setConfirmError(nextConfirmError ?? undefined);

    if (nextPasswordError || nextConfirmError) {
      return;
    }

    if (!token) {
      setServerError(
        "This reset link is invalid or has expired. Please request a new password reset.",
      );
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      await confirmPasswordReset({ token, new_password: password });
      navigate("/login", {
        replace: true,
        state: {
          passwordResetSuccess:
            "Password updated. You can sign in with your new password.",
        },
      });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-light tracking-headline text-foreground">
          Reset password
        </h1>
        <p className="mt-4 text-sm text-label">
          This reset link is invalid or has expired.
        </p>
        <p className="mt-4">
          <Link to="/forgot-password" className="font-medium text-accent">
            Request a new password reset
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <h1 className="text-3xl font-light tracking-headline text-foreground">
          Reset password
        </h1>
        <p className="mt-2 text-label">Choose a new password for your account.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-5 ds-card p-6"
      >
        {serverError && (
          <div role="alert" className="ds-alert-banner">
            <p>{serverError}</p>
            {serverError.toLowerCase().includes("invalid") ||
            serverError.toLowerCase().includes("expired") ? (
              <p className="mt-2">
                <Link to="/forgot-password" className="font-medium text-accent">
                  Request a new password reset
                </Link>
              </p>
            ) : null}
          </div>
        )}

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(undefined);
              setServerError(null);
            }}
            onBlur={() =>
              setPasswordError(validateRegisterPassword(password) ?? undefined)
            }
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? "password-error" : "password-hint"}
            className={inputClassName}
          />
          <p id="password-hint" className="mt-1 text-xs text-label">
            {getPasswordHint()}
          </p>
          {passwordError && (
            <p id="password-error" className="mt-1 ds-field-error">
              {passwordError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-foreground"
          >
            Confirm new password
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setConfirmError(undefined);
              setServerError(null);
            }}
            onBlur={() =>
              setConfirmError(
                password !== confirmPassword ? "Passwords do not match" : undefined,
              )
            }
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? "confirm-password-error" : undefined}
            className={inputClassName}
          />
          {confirmError && (
            <p id="confirm-password-error" className="mt-1 ds-field-error">
              {confirmError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-label">
        <Link to="/login" className="font-medium text-accent">
          Back to login
        </Link>
      </p>
    </div>
  );
}
