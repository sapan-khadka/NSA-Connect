import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import {
  requestPasswordReset,
} from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  SEMO_EMAIL_DOMAIN,
  validateSemoEmail,
} from "../lib/validation";

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

      <Card
        as="form"
        onSubmit={handleSubmit}
        noValidate
        padding="md"
        className="mt-8 space-y-5"
      >
        {successMessage && (
          <Card
            as="p"
            nested
            padding="none"
            role="status"
            className="px-4 py-3 text-sm text-foreground"
          >
            {successMessage}
          </Card>
        )}

        {serverError && (
          <p role="alert" className="ds-alert-banner">
            {serverError}
          </p>
        )}

        <Input
          id="email"
          name="email"
          label="Email"
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

        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          className="w-full"
        >
          Send reset link
        </Button>
      </Card>

      <p className="mt-4 text-center text-sm text-label">
        Remember your password?{" "}
        <Link to="/login" className="font-medium text-accent">
          Back to login
        </Link>
      </p>
    </div>
  );
}
