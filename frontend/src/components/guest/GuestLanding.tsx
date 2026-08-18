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
import {
  isEmailNotVerifiedError,
  isPendingApprovalError,
  loginMember,
  resendEmailVerification,
} from "../../lib/auth-api";
import { getApiErrorMessage } from "../../lib/api-error";
import { getDashboardPath } from "../../lib/roles";
import {
  validateEmailAddress,
  validateLoginForm,
  validateLoginPassword,
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
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof LoginFormValues>(
    field: K,
    value: LoginFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setIsPendingApproval(false);
    setNeedsEmailVerification(false);
    setResendMessage(null);
  }

  function validateField(field: keyof LoginFormValues) {
    const error =
      field === "email"
        ? validateEmailAddress(values.email)
        : validateLoginPassword(values.password);

    setFieldErrors((current) => ({
      ...current,
      [field]: error ?? undefined,
    }));
  }

  async function handleResendVerification() {
    const emailError = validateEmailAddress(values.email);
    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    setServerError(null);
    try {
      const result = await resendEmailVerification(values.email);
      setResendMessage(result.message);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsResending(false);
    }
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
    setNeedsEmailVerification(false);
    setResendMessage(null);

    try {
      const tokens = await loginMember(values);
      const member = await login(tokens);
      navigate(redirectPath ?? getDashboardPath(member.role), { replace: true });
    } catch (error) {
      if (isPendingApprovalError(error)) {
        setIsPendingApproval(true);
      } else if (isEmailNotVerifiedError(error)) {
        setNeedsEmailVerification(true);
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
            Sign in with your @semo.edu email (or your chapter owner account).
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

      {needsEmailVerification ? (
        <div role="status" className="guest-notice">
          <p>Verify your email before signing in</p>
          <p>
            Check your inbox for the NSA Connect verification link. Fake or
            mistyped addresses cannot be approved until the real mailbox
            confirms.
          </p>
          <button
            type="button"
            className="guest-link"
            onClick={() => void handleResendVerification()}
            disabled={isResending}
          >
            {isResending ? "Sending…" : "Resend verification email"}
          </button>
          {resendMessage ? <p>{resendMessage}</p> : null}
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
