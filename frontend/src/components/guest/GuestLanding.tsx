import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  Lock,
  Mail,
  Users,
} from "lucide-react";

import nsaCover from "../../assets/nsa-cover.png";
import nsaEmblem from "../../assets/nsa-emblem.png";
import { useAuth } from "../../context/useAuth";
import { isPendingApprovalError, loginMember } from "../../lib/auth-api";
import { getApiErrorMessage } from "../../lib/api-error";
import { getDashboardPath } from "../../lib/roles";
import {
  SEMO_EMAIL_DOMAIN,
  validateLoginForm,
  validateLoginPassword,
  validateSemoEmail,
  type LoginFormErrors,
  type LoginFormValues,
} from "../../lib/validation";
import { AppIcon } from "../ui/AppIcon";
import { GuestField } from "./GuestField";

const initialValues: LoginFormValues = {
  email: "",
  password: "",
};

const FEATURES = [
  { icon: Users, label: "Members" },
  { icon: CalendarDays, label: "Events" },
  { icon: ClipboardCheck, label: "Tasks" },
] as const;

export function GuestLanding() {
  return (
    <div className="guest-landing">
      <section className="guest-intro">
        <p className="guest-kicker">Namaste</p>
        <h1 className="guest-landing-title">
          Your community.
          <span>Your connection.</span>
        </h1>
        <p className="guest-landing-lede">
          NSA Connect is the space for members, events, and opportunities.
        </p>
        <ul className="guest-feature-row">
          {FEATURES.map((feature) => (
            <li key={feature.label}>
              <AppIcon icon={feature.icon} size="sm" />
              {feature.label}
            </li>
          ))}
        </ul>
        <div className="guest-collage">
          <div className="guest-collage-frame guest-collage-frame--a">
            <img
              src={nsaCover}
              alt="Nepalese Students Association at SEMO community events, cultural celebrations, and student life"
              data-testid="nsa-cover-banner"
            />
          </div>
          <div className="guest-collage-frame guest-collage-frame--b">
            <img src={nsaCover} alt="" />
          </div>
          <div className="guest-collage-frame guest-collage-frame--c">
            <img src={nsaCover} alt="" />
          </div>
          <span className="guest-collage-seal">
            <img src={nsaEmblem} alt="" />
          </span>
        </div>
      </section>

      <LoginCard />
    </div>
  );
}

export function LoginCard() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : null;
  const redirectPath =
    (location.state as { from?: string } | null)?.from ?? safeNext;
  const passwordResetSuccess = (
    location.state as { passwordResetSuccess?: string } | null
  )?.passwordResetSuccess;
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
    <form className="guest-auth-card" onSubmit={handleSubmit} noValidate>
      <header className="guest-auth-header">
        <p className="guest-card-kicker">Account</p>
        <h2>Welcome back</h2>
        <p className="guest-auth-lede">
          Sign in with your @{SEMO_EMAIL_DOMAIN} email.
        </p>
      </header>

      {passwordResetSuccess ? (
        <p role="status" className="guest-notice">
          {passwordResetSuccess}
        </p>
      ) : null}

      {isPendingApproval ? (
        <div role="status" className="guest-notice">
          <p>Your account is pending approval</p>
          <p>
            Your registration was received successfully. A board member will
            review your request soon. You&apos;ll be able to sign in once your
            account is approved.
          </p>
        </div>
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
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          onBlur={() => validateField("email")}
          error={fieldErrors.email}
          placeholder="mukesh@semo.edu"
        />
        <GuestField
          id="password"
          name="password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(event) => updateField("password", event.target.value)}
          onBlur={() => validateField("password")}
          error={fieldErrors.password}
          action={
            <Link to="/forgot-password" className="guest-field-action">
              Forgot password?
            </Link>
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
          {isSubmitting ? "Signing in..." : "Sign in"}
          <AppIcon icon={ArrowRight} size="sm" />
        </button>
        <div className="guest-or" role="separator" aria-label="or">
          <span>OR</span>
        </div>
        <button type="button" className="guest-btn-google">
          <GoogleMark />
          Continue with Google
        </button>
        <p className="guest-auth-footer">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="guest-link">
            Register
          </Link>
        </p>
      </div>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg
      className="guest-google-mark"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.07-1.68-.21-2.47H12v4.68h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.83Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.74-2.47 1.18-4.07 1.18-3.13 0-5.78-2.11-6.73-4.95H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.33A7.2 7.2 0 0 1 4.89 12c0-.81.14-1.59.38-2.33V6.58H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.42l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.95 1.19 15.23 0 12 0 7.31 0 3.26 2.69 1.27 6.58l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
