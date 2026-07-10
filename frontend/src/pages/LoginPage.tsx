import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { getApiErrorMessage, isPendingApprovalError, loginMember } from "../lib/auth-api";
import { getDashboardPath } from "../lib/roles";
import {
  SEMO_EMAIL_DOMAIN,
  validateLoginForm,
  validateLoginPassword,
  validateSemoEmail,
  type LoginFormErrors,
  type LoginFormValues,
} from "../lib/validation";

const initialValues: LoginFormValues = {
  email: "",
  password: "",
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath =
    (location.state as { from?: string } | null)?.from ?? null;
  const [values, setValues] = useState<LoginFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof LoginFormValues>(
    field: K,
    value: LoginFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setIsPendingApproval(false);
  }

  function validateField(field: keyof LoginFormValues) {
    const error =
      field === "email"
        ? validateSemoEmail(values.email)
        : validateLoginPassword(values.password);

    setFieldErrors((current) => ({
      ...current,
      [field]: error ?? undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateLoginForm(values);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setIsPendingApproval(false);

    try {
      const tokens = await loginMember(values);
      const member = await login(tokens);
      navigate(redirectPath ?? getDashboardPath(member.role), { replace: true });
    } catch (error) {
      if (isPendingApprovalError(error)) {
        setIsPendingApproval(true);
      } else {
        setServerError(getApiErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <h1 className="text-3xl font-light tracking-headline text-foreground">Login</h1>
        <p className="mt-2 text-label">
          Sign in with your @{SEMO_EMAIL_DOMAIN} email
        </p>
      </div>

      <Card
        as="form"
        onSubmit={handleSubmit}
        noValidate
        padding="md"
        className="mt-8 space-y-5"
      >
        {isPendingApproval && (
          <Card
            as="div"
            nested
            padding="none"
            role="status"
            className="px-4 py-3 text-sm text-foreground"
          >
            <p className="font-medium">Your account is pending approval</p>
            <p className="mt-1">
              Your registration was received successfully. A board member will
              review your request soon. You&apos;ll be able to sign in once your
              account is approved.
            </p>
          </Card>
        )}

        {serverError && (
          <p
            role="alert"
            className="ds-alert-banner"
          >
            {serverError}
          </p>
        )}

        <Input
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          onBlur={() => validateField("email")}
          error={fieldErrors.email}
          placeholder="you@semo.edu"
        />

        <div>
          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => updateField("password", event.target.value)}
            onBlur={() => validateField("password")}
            error={fieldErrors.password}
          />
          <p className="mt-2 text-right text-sm">
            <Link to="/forgot-password" className="font-medium text-accent">
              Forgot password?
            </Link>
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          className="w-full"
        >
          Sign in
        </Button>
      </Card>

      <p className="mt-4 text-center text-sm text-label">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-medium text-accent">
          Register
        </Link>
      </p>
    </div>
  );
}
