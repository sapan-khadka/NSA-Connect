import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { confirmEmailVerification } from "../lib/auth-api";
import { getApiErrorMessage } from "../lib/api-error";

type VerifyState = "loading" | "success" | "error" | "missing";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<VerifyState>(token ? "loading" : "missing");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const result = await confirmEmailVerification(token);
        if (cancelled) {
          return;
        }
        setMessage(result.message);
        setState("success");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setMessage(getApiErrorMessage(error));
        setState("error");
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="guest-auth-shell">
      <div className="guest-auth-card">
        <header className="guest-auth-header">
          <p className="guest-card-kicker">Account</p>
          <h1>
            {state === "success"
              ? "Email verified"
              : state === "loading"
                ? "Verifying email"
                : "Verification needed"}
          </h1>
          <p className="guest-auth-lede">
            {state === "loading"
              ? "Confirming your school email…"
              : state === "success"
                ? "Your email is confirmed. After a board member approves your account, you can sign in."
                : state === "missing"
                  ? "This verification link is missing a token. Open the link from your email, or request a new one from the login page."
                  : (message ??
                    "This verification link is invalid or has expired.")}
          </p>
        </header>

        {state === "success" && message ? (
          <p role="status" className="guest-notice">
            {message}
          </p>
        ) : null}

        {state === "error" ? (
          <div role="alert" className="guest-alert">
            <p>{message}</p>
          </div>
        ) : null}

        <div className="guest-auth-actions">
          {state === "success" ? (
            <Link to="/login" className="guest-btn guest-btn-block">
              Go to login
            </Link>
          ) : state === "loading" ? null : (
            <>
              <Link to="/login" className="guest-btn guest-btn-block">
                Back to login
              </Link>
              <p className="guest-auth-footer">
                Need a new link? Sign in once and use Resend, or register again
                if you never received mail.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
