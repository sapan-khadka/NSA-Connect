import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, inputFieldClassName } from "../components/ui/Input";
import { registerMember } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";
import {
  SEMO_EMAIL_DOMAIN,
  getGraduationYearOptions,
  getPasswordHint,
  validateRegisterField,
  validateRegisterForm,
  type RegisterFormErrors,
  type RegisterFormValues,
} from "../lib/validation";

const graduationYears = getGraduationYearOptions();

const initialValues: RegisterFormValues = {
  full_name: "",
  email: "",
  password: "",
  student_id: "",
  major: "",
  graduation_year: "",
};

const selectClassName = `${inputFieldClassName} mt-1`;

export function RegisterPage() {
  const [values, setValues] = useState<RegisterFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  function updateField<K extends keyof RegisterFormValues>(
    field: K,
    value: RegisterFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
  }

  function validateField(field: keyof RegisterFormValues) {
    const error = validateRegisterField(field, values[field], values);

    setFieldErrors((current) => ({
      ...current,
      [field]: error ?? undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateRegisterForm(values);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      await registerMember({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        student_id: values.student_id,
        major: values.major,
        graduation_year: Number(values.graduation_year),
      });
      setIsComplete(true);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-light tracking-headline text-foreground">Registration submitted</h1>
        <p className="mt-4 text-label">
          Your account is pending board approval. You&apos;ll be able to sign in
          once a board member approves your registration.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block font-medium text-accent"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <h1 className="text-3xl font-light tracking-headline text-foreground">Register</h1>
        <p className="mt-2 text-label">
          Join NSA Connect with your @{SEMO_EMAIL_DOMAIN} email
        </p>
      </div>

      <Card
        as="form"
        onSubmit={handleSubmit}
        noValidate
        padding="md"
        className="mt-8 space-y-5"
      >
        {serverError && (
          <p
            role="alert"
            className="ds-alert-banner"
          >
            {serverError}
          </p>
        )}

        <Input
          id="full_name"
          name="full_name"
          label="Full name"
          type="text"
          autoComplete="name"
          value={values.full_name}
          onChange={(event) => updateField("full_name", event.target.value)}
          onBlur={() => validateField("full_name")}
          error={fieldErrors.full_name}
          placeholder="Sapan Khadka"
        />

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

        <Input
          id="student_id"
          name="student_id"
          label="Student ID"
          type="text"
          autoComplete="off"
          value={values.student_id}
          onChange={(event) => updateField("student_id", event.target.value)}
          onBlur={() => validateField("student_id")}
          error={fieldErrors.student_id}
          placeholder="S12345678"
        />

        <Input
          id="major"
          name="major"
          label="Major"
          type="text"
          autoComplete="organization-title"
          value={values.major}
          onChange={(event) => updateField("major", event.target.value)}
          onBlur={() => validateField("major")}
          error={fieldErrors.major}
          placeholder="Computer Science"
        />

        <div>
          <label
            htmlFor="graduation_year"
            className="block text-sm font-medium text-foreground"
          >
            Graduation year
          </label>
          <select
            id="graduation_year"
            name="graduation_year"
            value={values.graduation_year}
            onChange={(event) => updateField("graduation_year", event.target.value)}
            onBlur={() => validateField("graduation_year")}
            aria-invalid={fieldErrors.graduation_year ? true : undefined}
            aria-describedby={
              fieldErrors.graduation_year ? "graduation_year-error" : undefined
            }
            className={selectClassName}
          >
            <option value="">Select year</option>
            {graduationYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {fieldErrors.graduation_year && (
            <p id="graduation_year-error" className="mt-1 ds-field-error">
              {fieldErrors.graduation_year}
            </p>
          )}
        </div>

        <div>
          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => updateField("password", event.target.value)}
            onBlur={() => validateField("password")}
            error={fieldErrors.password}
            hint={
              <>
                {getPasswordHint()}
                {values.password
                  ? ` (${values.password.length} characters)`
                  : ""}
              </>
            }
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
          className="w-full"
        >
          Create account
        </Button>
      </Card>

      <p className="mt-4 text-center text-sm text-label">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
