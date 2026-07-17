import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import {
  confirmPasswordReset,
} from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  getPasswordHint,
  validateRegisterPassword,
} from "../lib/validation";

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

      <Card
        as="form"
        onSubmit={handleSubmit}
        noValidate
        padding="md"
        className="mt-8 space-y-5"
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

        <Input
          id="password"
          name="password"
          label="New password"
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

        <Input
          id="confirm-password"
          name="confirm-password"
          label="Confirm new password"
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
          error={confirmError}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          className="w-full"
        >
          Update password
        </Button>
      </Card>

      <p className="mt-4 text-center text-sm text-label">
        <Link to="/login" className="font-medium text-accent">
          Back to login
        </Link>
      </p>
    </div>
  );
}
