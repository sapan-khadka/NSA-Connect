import { useState } from "react";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { sendTestEmail } from "../lib/notifications-api";
import { validateEmailAddress } from "../lib/validation";
import { inputFieldClassName } from "./ui/Input";

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
    <section className="settings-block is-flush">
      <div className="settings-field">
        <label htmlFor="settings-test-email">Recipient</label>
        <input
          id="settings-test-email"
          type="email"
          value={recipientEmail}
          onChange={(event) => setRecipientEmail(event.target.value)}
          placeholder="you@example.com"
          className={`${inputFieldClassName} rounded-md`}
        />
      </div>
      <div className="settings-actions">
        <button
          type="button"
          onClick={() => void handleSendTestEmail()}
          disabled={isSending}
          className="event-command-btn"
        >
          {isSending ? "Sending…" : "Send test email"}
        </button>
      </div>
      {message ? (
        <p className="settings-status" role="status">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="settings-status is-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
