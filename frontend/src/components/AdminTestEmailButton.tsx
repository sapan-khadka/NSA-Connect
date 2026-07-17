import { useState } from "react";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { sendTestEmail } from "../lib/notifications-api";
import { validateEmailAddress } from "../lib/validation";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";

const inputClassName = `${inputFieldClassName} min-w-[14rem] flex-1`;

export function AdminTestEmailButton() {
  const { member } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState(member?.email ?? "");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSendTestEmail() {
    const validationError = validateEmailAddress(recipientEmail);
    if (validationError) {
      setMessage(null);
      setErrorMessage(validationError);
      return;
    }

    setIsSending(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await sendTestEmail(recipientEmail);
      setMessage(response.message);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card padding="md">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">
          Email connection test
        </h2>
        <p className="mt-1 text-sm text-label">
          Board-only: send a test email to any address via Resend.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block min-w-[14rem] flex-1 space-y-1 text-sm">
          <span className="text-label">Recipient email</span>
          <input
            type="email"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            placeholder="you@example.com"
            className={inputClassName}
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSendTestEmail()}
          disabled={isSending}
          className="rounded-full border border-gray-200 bg-surface-card px-4 py-2 text-sm text-foreground hover:border-accent disabled:opacity-60"
        >
          {isSending ? "Sending…" : "Send test email"}
        </button>
      </div>

      {message ? (
        <p className="mt-3 text-sm text-primary" role="status">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </Card>
  );
}
