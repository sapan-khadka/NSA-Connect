import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { GraduationCap, IdCard, Lock, Mail, User } from "lucide-react";

import { GuestField } from "../components/guest/GuestField";
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

const STEP_ONE_FIELDS: Array<keyof RegisterFormValues> = [
  "full_name",
  "email",
  "student_id",
];

export function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
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

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: RegisterFormErrors = {};
    for (const field of STEP_ONE_FIELDS) {
      const error = validateRegisterField(field, values[field], values);
      if (error) {
        nextErrors[field] = error;
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setStep(2);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validateRegisterForm(values);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      if (STEP_ONE_FIELDS.some((field) => errors[field])) {
        setStep(1);
      }
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

  const currentStep = isComplete ? 2 : step;

  return (
    <div className="guest-auth-shell">
      <div className="guest-auth-card">
        <RegisterStepper
          step={currentStep}
          onBack={step === 2 && !isComplete ? () => setStep(1) : undefined}
        />

        {isComplete ? (
          <>
            <header className="guest-auth-header">
              <p className="guest-card-kicker">Check your email</p>
              <h1>Verify your school email</h1>
              <p className="guest-auth-lede">
                We sent a verification link to{" "}
                <strong>{values.email.trim().toLowerCase()}</strong>. Open that
                link to prove you own the inbox. After verification, a board
                member still needs to approve student accounts before you can
                sign in.
              </p>
            </header>
            <div className="guest-auth-actions">
              <Link to="/login" className="guest-btn guest-btn-block">
                Go to login
              </Link>
              <p className="guest-auth-footer">
                Didn&apos;t get it? Check spam, then use Resend on the login
                page after trying to sign in.
              </p>
            </div>
          </>
        ) : step === 1 ? (
          <form onSubmit={handleContinue} noValidate>
            <header className="guest-auth-header">
              <p className="guest-card-kicker">Step 1 of 2</p>
              <h1>Create your account</h1>
              <p className="guest-auth-lede">
                Use your @{SEMO_EMAIL_DOMAIN} email (chapter owner accounts use
                the address your board configured). You must verify that inbox
                before a board member can approve your account.
              </p>
            </header>

            <div className="guest-auth-fields">
              <GuestField
                id="full_name"
                name="full_name"
                label="Full name"
                icon={User}
                type="text"
                autoComplete="name"
                value={values.full_name}
                onChange={(event) => updateField("full_name", event.target.value)}
                onBlur={() => validateField("full_name")}
                error={fieldErrors.full_name}
                placeholder="Sapan Khadka"
              />
              <GuestField
                id="email"
                name="email"
                label="School email"
                icon={Mail}
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                onBlur={() => validateField("email")}
                error={fieldErrors.email}
                placeholder="you@semo.edu"
              />
              <GuestField
                id="student_id"
                name="student_id"
                label="Student ID"
                icon={IdCard}
                type="text"
                autoComplete="off"
                value={values.student_id}
                onChange={(event) => updateField("student_id", event.target.value)}
                onBlur={() => validateField("student_id")}
                error={fieldErrors.student_id}
                placeholder="S12345678"
              />
            </div>

            <div className="guest-auth-actions">
              <button type="submit" className="guest-btn guest-btn-block">
                Continue
              </button>
              <p className="guest-auth-footer">
                Already have an account?{" "}
                <Link to="/login" className="guest-link">
                  Login
                </Link>
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <header className="guest-auth-header">
              <p className="guest-card-kicker">Step 2 of 2</p>
              <h1>Tell us about yourself</h1>
              <p className="guest-auth-lede">
                This helps the chapter know who is joining.
              </p>
            </header>

            {serverError ? (
              <p role="alert" className="guest-alert">
                {serverError}
              </p>
            ) : null}

            <div className="guest-auth-fields">
              <GuestField
                id="major"
                name="major"
                label="Major"
                icon={GraduationCap}
                type="text"
                autoComplete="organization-title"
                value={values.major}
                onChange={(event) => updateField("major", event.target.value)}
                onBlur={() => validateField("major")}
                error={fieldErrors.major}
                placeholder="Computer Science"
              />

              <div className="guest-field">
                <div className="guest-field-label-row">
                  <label htmlFor="graduation_year">Graduation year</label>
                </div>
                <div
                  className={[
                    "guest-field-control",
                    fieldErrors.graduation_year ? "is-error" : "",
                  ].join(" ")}
                >
                  <select
                    id="graduation_year"
                    name="graduation_year"
                    value={values.graduation_year}
                    onChange={(event) =>
                      updateField("graduation_year", event.target.value)
                    }
                    onBlur={() => validateField("graduation_year")}
                    aria-invalid={fieldErrors.graduation_year ? true : undefined}
                  >
                    <option value="">Select year</option>
                    {graduationYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldErrors.graduation_year ? (
                  <p id="graduation_year-error" className="guest-field-error">
                    {fieldErrors.graduation_year}
                  </p>
                ) : null}
              </div>

              <GuestField
                id="password"
                name="password"
                label="Password"
                icon={Lock}
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) => updateField("password", event.target.value)}
                onBlur={() => validateField("password")}
                error={fieldErrors.password}
                hint={
                  <>
                    {getPasswordHint()}
                    {values.password ? ` (${values.password.length} characters)` : ""}
                  </>
                }
              />
            </div>

            <div className="guest-auth-actions">
              <button
                type="submit"
                className="guest-btn guest-btn-block"
                disabled={isSubmitting}
                aria-busy={isSubmitting || undefined}
              >
                {isSubmitting ? "Creating account..." : "Create account"}
              </button>
              <p className="guest-auth-footer">
                Already have an account?{" "}
                <Link to="/login" className="guest-link">
                  Login
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RegisterStepper({
  step,
  onBack,
}: {
  step: 1 | 2;
  onBack?: () => void;
}) {
  return (
    <ol className="guest-stepper" aria-label="Registration steps">
      <li className={step >= 1 ? (step === 1 ? "is-current" : "is-done") : ""}>
        {step === 2 && onBack ? (
          <button type="button" onClick={onBack}>
            Account
          </button>
        ) : (
          <span>Account</span>
        )}
        <span className="guest-step-track" />
      </li>
      <li className={step >= 2 ? "is-current" : ""}>
        <span>Profile</span>
        <span className="guest-step-track" />
      </li>
    </ol>
  );
}
