import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { getApiErrorMessage, registerMember } from "../lib/auth-api";
import {
  SEMO_EMAIL_DOMAIN,
  getGraduationYearOptions,
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

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
    const error = validateRegisterField(field, values[field]);

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

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 space-y-5 rounded-card bg-surface-card p-6"
      >
        {serverError && (
          <p
            role="alert"
            className="ds-alert-banner"
          >
            {serverError}
          </p>
        )}

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-foreground">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            value={values.full_name}
            onChange={(event) => updateField("full_name", event.target.value)}
            onBlur={() => validateField("full_name")}
            aria-invalid={fieldErrors.full_name ? true : undefined}
            aria-describedby={fieldErrors.full_name ? "full_name-error" : undefined}
            className={inputClassName}
            placeholder="Sapan Khadka"
          />
          {fieldErrors.full_name && (
            <p id="full_name-error" className="mt-1 ds-field-error">
              {fieldErrors.full_name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            onBlur={() => validateField("email")}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            className={inputClassName}
            placeholder="you@semo.edu"
          />
          {fieldErrors.email && (
            <p id="email-error" className="mt-1 ds-field-error">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="student_id"
            className="block text-sm font-medium text-foreground"
          >
            Student ID
          </label>
          <input
            id="student_id"
            name="student_id"
            type="text"
            autoComplete="off"
            value={values.student_id}
            onChange={(event) => updateField("student_id", event.target.value)}
            onBlur={() => validateField("student_id")}
            aria-invalid={fieldErrors.student_id ? true : undefined}
            aria-describedby={fieldErrors.student_id ? "student_id-error" : undefined}
            className={inputClassName}
            placeholder="S12345678"
          />
          {fieldErrors.student_id && (
            <p id="student_id-error" className="mt-1 ds-field-error">
              {fieldErrors.student_id}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="major" className="block text-sm font-medium text-foreground">
            Major
          </label>
          <input
            id="major"
            name="major"
            type="text"
            autoComplete="organization-title"
            value={values.major}
            onChange={(event) => updateField("major", event.target.value)}
            onBlur={() => validateField("major")}
            aria-invalid={fieldErrors.major ? true : undefined}
            aria-describedby={fieldErrors.major ? "major-error" : undefined}
            className={inputClassName}
            placeholder="Computer Science"
          />
          {fieldErrors.major && (
            <p id="major-error" className="mt-1 ds-field-error">
              {fieldErrors.major}
            </p>
          )}
        </div>

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
            className={inputClassName}
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
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => updateField("password", event.target.value)}
            onBlur={() => validateField("password")}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className={inputClassName}
          />
          {fieldErrors.password && (
            <p id="password-error" className="mt-1 ds-field-error">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-primary px-4 py-2 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-label">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
