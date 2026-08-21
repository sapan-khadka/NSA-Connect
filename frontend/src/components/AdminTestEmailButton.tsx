import { useState } from "react";

import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { sendTestEmail } from "../lib/notifications-api";

export function AdminTestEmailButton() {
  const { member } = useAuth();
  const recipientEmail = member?.email?.trim() ?? "";
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSendTestEmail() {
    if (!recipientEmail) {
      setMessage(null);
      setErrorMessage("Your account has no email address.");
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
        <p className="text-sm text-label">
          Test mail is sent only to your signed-in address:{" "}
          <strong>{recipientEmail || "unknown"}</strong>
        </p>
      </div>
      <div className="settings-actions">
        <button
          type="button"
          onClick={() => void handleSendTestEmail()}
          disabled={isSending || !recipientEmail}
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
