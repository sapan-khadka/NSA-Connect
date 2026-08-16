import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { GuestField } from "../components/guest/GuestField";
import { Lock } from "lucide-react";
import { confirmPasswordReset } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { getPasswordHint, validateRegisterPassword } from "../lib/validation";

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

  const showResetLink =
    serverError != null &&
    (serverError.toLowerCase().includes("invalid") ||
      serverError.toLowerCase().includes("expired"));

  return (
    <div className="guest-auth-shell">
      {!token ? (
        <div className="guest-auth-card">
          <header className="guest-auth-header">
            <p className="guest-card-kicker">Account</p>
            <h1>Reset password</h1>
            <p className="guest-auth-lede">
              This reset link is invalid or has expired.
            </p>
          </header>
          <div className="guest-auth-actions">
            <Link to="/forgot-password" className="guest-btn guest-btn-block">
              Request a new password reset
            </Link>
          </div>
        </div>
      ) : (
        <form className="guest-auth-card" onSubmit={handleSubmit} noValidate>
          <header className="guest-auth-header">
            <p className="guest-card-kicker">Account</p>
            <h1>Reset password</h1>
            <p className="guest-auth-lede">
              Choose a new password for your account.
            </p>
          </header>

          {serverError ? (
            <div role="alert" className="guest-alert">
              <p>{serverError}</p>
              {showResetLink ? (
                <p>
                  <Link to="/forgot-password" className="guest-link">
                    Request a new password reset
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="guest-auth-fields">
            <GuestField
              id="password"
              name="password"
              label="New password"
              icon={Lock}
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
              error={passwordError}
              hint={getPasswordHint()}
            />
            <GuestField
              id="confirm-password"
              name="confirm-password"
              label="Confirm new password"
              icon={Lock}
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
                  password !== confirmPassword
                    ? "Passwords do not match"
                    : undefined,
                )
              }
              error={confirmError}
            />
          </div>

          <div className="guest-auth-actions">
            <button
              type="submit"
              className="guest-btn guest-btn-block"
              disabled={isSubmitting}
              aria-busy={isSubmitting || undefined}
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
            <p className="guest-auth-footer">
              <Link to="/login" className="guest-link">
                Back to login
              </Link>
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
