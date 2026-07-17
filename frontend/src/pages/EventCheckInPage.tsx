import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

import { AppIcon } from "../components/ui/AppIcon";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { inputFieldClassName } from "../components/ui/Input";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import {
  checkInGuestToEvent,
  checkInToEvent,
  type EventCheckInResult,
  type EventGuestCheckInResult,
  type GuestAffiliationType,
} from "../lib/event-checkin-api";

type PageMode = "choose" | "guest-form" | "member-result" | "guest-result";

const pageShellClass = "mx-auto max-w-lg px-4 py-8 sm:px-0 sm:py-10";
const choiceButtonClass =
  "flex w-full min-h-11 items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-accent sm:px-5 sm:py-4";

export function EventCheckInPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const numericEventId = Number(eventId);
  const token = searchParams.get("token") ?? "";

  const [mode, setMode] = useState<PageMode>("choose");
  const [memberResult, setMemberResult] = useState<EventCheckInResult | null>(null);
  const [guestResult, setGuestResult] = useState<EventGuestCheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [affiliationType, setAffiliationType] = useState<GuestAffiliationType | "">("");
  const [relatedMemberName, setRelatedMemberName] = useState("");

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return;
    }
    if (!Number.isFinite(numericEventId) || !token) {
      setErrorMessage("This check-in link is invalid.");
      return;
    }

    let cancelled = false;

    async function submitMemberCheckIn() {
      setSubmitting(true);
      setErrorMessage(null);
      try {
        const response = await checkInToEvent(numericEventId, token);
        if (!cancelled) {
          setMemberResult(response);
          setMode("member-result");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setSubmitting(false);
        }
      }
    }

    void submitMemberCheckIn();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, numericEventId, token]);

  if (!token || !Number.isFinite(numericEventId)) {
    return (
      <div className={`${pageShellClass} space-y-4`}>
        <div className="ds-alert-banner p-5 sm:p-6" role="alert">
          This check-in link is invalid.
        </div>
        <Link to="/" className="ds-link">
          Back to home
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-label">
        Checking your session…
      </div>
    );
  }

  if (isAuthenticated && submitting && mode === "choose") {
    return (
      <div className="px-4 py-16 text-center text-sm text-label">
        Checking you in…
      </div>
    );
  }

  if (isAuthenticated && errorMessage && mode === "choose") {
    return (
      <div className={`${pageShellClass} space-y-4`}>
        <div className="ds-alert-banner p-5 sm:p-6" role="alert">
          {errorMessage}
        </div>
        <Link to={`/events/${numericEventId}`} className="ds-link">
          View event
        </Link>
      </div>
    );
  }

  if (isAuthenticated && memberResult) {
    const isSuccess = memberResult.status === "checked_in";

    return (
      <div className={pageShellClass}>
        <Card padding="none" className="p-5 sm:p-8 text-center">
          <div
            className={[
              "flex justify-center",
              isSuccess ? "text-accent" : "text-label",
            ].join(" ")}
            aria-hidden
          >
            <AppIcon
              icon={isSuccess ? CheckCircle2 : Circle}
              size="xl"
              className="text-current"
            />
          </div>
          <h1 className="mt-4 text-2xl font-light tracking-headline text-foreground">
            {isSuccess ? "You're checked in!" : "Already checked in"}
          </h1>
          <p className="mt-3 text-sm text-label">{memberResult.event_name}</p>
          <p className="mt-6 text-sm leading-relaxed text-foreground">
            {memberResult.message}
          </p>
          {memberResult.checked_in_at ? (
            <p className="mt-2 text-xs text-label">
              Checked in at {new Date(memberResult.checked_in_at).toLocaleString()}
            </p>
          ) : null}
        </Card>

        <div className="mt-6 text-center">
          <Link to={`/events/${numericEventId}`} className="ds-link">
            View event details
          </Link>
        </div>
      </div>
    );
  }

  if (guestResult) {
    return (
      <div className={pageShellClass}>
        <Card padding="none" className="p-5 sm:p-8 text-center">
          <div className="flex justify-center text-accent" aria-hidden>
            <AppIcon icon={CheckCircle2} size="xl" className="text-current" />
          </div>
          <h1 className="mt-4 text-2xl font-light tracking-headline text-foreground">
            You&apos;re checked in!
          </h1>
          <p className="mt-3 text-sm text-label">{guestResult.event_name}</p>
          <p className="mt-6 text-sm leading-relaxed text-foreground">
            {guestResult.message}
          </p>
          <p className="mt-2 text-xs text-label">
            Checked in at {new Date(guestResult.checked_in_at).toLocaleString()}
          </p>
        </Card>
      </div>
    );
  }

  async function handleGuestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter your name.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await checkInGuestToEvent(numericEventId, {
        token,
        guest_name: trimmedName,
        affiliation_type: affiliationType || null,
        related_member_name:
          affiliationType === "guest_of_member" && relatedMemberName.trim()
            ? relatedMemberName.trim()
            : null,
      });
      setGuestResult(response);
      setMode("guest-result");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const loginRedirect = `${location.pathname}${location.search}`;

  if (mode === "guest-form") {
    return (
      <div className={pageShellClass}>
        <Card padding="none" className="p-5 sm:p-8">
          <h1 className="text-2xl font-light tracking-headline text-foreground">
            Guest check-in
          </h1>
          <p className="mt-2 text-sm text-label">
            Enter your name to check in. Affiliation details are optional.
          </p>

          {errorMessage ? (
            <p className="mt-4 text-sm text-overdue" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <form
            className="mt-6 space-y-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onSubmit={(event) => void handleGuestSubmit(event)}
          >
            <label className="block">
              <span className="text-sm font-medium text-foreground">
                Name <span className="text-overdue">*</span>
              </span>
              <input
                type="text"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                required
                autoFocus
                className={`${inputFieldClassName} mt-1`}
                placeholder="Your full name"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">
                I&apos;m attending as… <span className="text-label">(optional)</span>
              </span>
              <select
                value={affiliationType}
                onChange={(event) => {
                  const value = event.target.value as GuestAffiliationType | "";
                  setAffiliationType(value);
                  if (value !== "guest_of_member") {
                    setRelatedMemberName("");
                  }
                }}
                className={`${inputFieldClassName} mt-1`}
              >
                <option value="">Skip — no affiliation</option>
                <option value="guest_of_member">Guest of a member</option>
                <option value="faculty_staff">Faculty/Staff</option>
              </select>
            </label>

            {affiliationType === "guest_of_member" ? (
              <label className="block">
                <span className="text-sm font-medium text-foreground">
                  Member name <span className="text-label">(optional)</span>
                </span>
                <input
                  type="text"
                  value={relatedMemberName}
                  onChange={(event) => setRelatedMemberName(event.target.value)}
                  className={`${inputFieldClassName} mt-1`}
                  placeholder="Which member invited you?"
                />
              </label>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Button
                type="submit"
                disabled={submitting}
                loading={submitting}
                size="lg"
                className="w-full sm:w-auto"
              >
                Check in
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMode("choose");
                  setErrorMessage(null);
                }}
                size="lg"
                className="w-full sm:w-auto"
              >
                Back
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <Card padding="none" className="p-5 sm:p-8">
        <h1 className="text-2xl font-light tracking-headline text-foreground">
          Event check-in
        </h1>
        <p className="mt-2 text-sm text-label">
          Choose how you&apos;d like to check in for this event.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            to="/login"
            state={{ from: loginRedirect }}
            className={choiceButtonClass}
          >
            <span className="min-w-0 pr-3">
              <span className="block text-sm font-medium text-foreground">
                Log in to check in as a member
              </span>
              <span className="mt-1 block text-xs text-label">
                For NSA Connect members with an account
              </span>
            </span>
            <AppIcon icon={ChevronRight} size="sm" className="text-label" />
          </Link>

          <button
            type="button"
            onClick={() => setMode("guest-form")}
            className={choiceButtonClass}
          >
            <span className="min-w-0 pr-3">
              <span className="block text-sm font-medium text-foreground">
                Check in as a guest
              </span>
              <span className="mt-1 block text-xs text-label">
                For faculty, guests, and visitors without an account
              </span>
            </span>
            <AppIcon icon={ChevronRight} size="sm" className="text-label" />
          </button>
        </div>
      </Card>
    </div>
  );
}
