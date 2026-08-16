import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { GuestField } from "../components/guest/GuestField";
import { Mail } from "lucide-react";
import { requestPasswordReset } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import { SEMO_EMAIL_DOMAIN, validateSemoEmail } from "../lib/validation";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailError = validateSemoEmail(email);
    setFieldError(emailError ?? undefined);

    if (emailError) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await requestPasswordReset(email);
      setSuccessMessage(response.message);
      setEmail("");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="guest-auth-shell">
      <form className="guest-auth-card" onSubmit={handleSubmit} noValidate>
        <header className="guest-auth-header">
          <p className="guest-card-kicker">Account</p>
          <h1>Forgot password</h1>
          <p className="guest-auth-lede">
            Enter your @{SEMO_EMAIL_DOMAIN} email and we&apos;ll send a reset
            link if an account exists.
          </p>
        </header>

        {successMessage ? (
          <p role="status" className="guest-notice">
            {successMessage}
          </p>
        ) : null}

        {serverError ? (
          <p role="alert" className="guest-alert">
            {serverError}
          </p>
        ) : null}

        <div className="guest-auth-fields">
          <GuestField
            id="email"
            name="email"
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError(undefined);
              setServerError(null);
            }}
            onBlur={() => setFieldError(validateSemoEmail(email) ?? undefined)}
            error={fieldError}
            placeholder="you@semo.edu"
          />
        </div>

        <div className="guest-auth-actions">
          <button
            type="submit"
            className="guest-btn guest-btn-block"
            disabled={isSubmitting}
            aria-busy={isSubmitting || undefined}
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
          <p className="guest-auth-footer">
            Remember your password?{" "}
            <Link to="/login" className="guest-link">
              Back to login
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
