import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  getApiErrorMessage,
  requestPasswordReset,
} from "../lib/auth-api";
import {
  SEMO_EMAIL_DOMAIN,
  validateSemoEmail,
} from "../lib/validation";

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <h1 className="text-3xl font-light tracking-headline text-foreground">
          Forgot password
        </h1>
        <p className="mt-2 text-label">
          Enter your @{SEMO_EMAIL_DOMAIN} email and we&apos;ll send a reset link
          if an account exists.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-5 ds-card p-6"
      >
        {successMessage && (
          <p role="status" className="ds-card-nested px-4 py-3 text-sm text-foreground">
            {successMessage}
          </p>
        )}

        {serverError && (
          <p role="alert" className="ds-alert-banner">
            {serverError}
          </p>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError(undefined);
              setServerError(null);
            }}
            onBlur={() => setFieldError(validateSemoEmail(email) ?? undefined)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "email-error" : undefined}
            className={inputClassName}
            placeholder="you@semo.edu"
          />
          {fieldError && (
            <p id="email-error" className="mt-1 ds-field-error">
              {fieldError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-label">
        Remember your password?{" "}
        <Link to="/login" className="font-medium text-accent">
          Back to login
        </Link>
      </p>
    </div>
  );
}
