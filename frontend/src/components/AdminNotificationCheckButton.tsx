import { useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  runNotificationCheck,
  type NotificationCheckSummary,
} from "../lib/notifications-api";

function formatSummary(summary: NotificationCheckSummary): string {
  const parts = [
    `Event reminders: ${summary.event_reminders.sent} sent`,
    `RSVP nudges: ${summary.rsvp_nudges.sent} sent`,
    `Task due reminders: ${summary.task_due_reminders.sent} sent`,
    `Dues reminders: ${summary.dues_reminders.sent} sent`,
  ];
  return parts.join(" · ");
}

export function AdminNotificationCheckButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRunCheck() {
    setIsRunning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const summary = await runNotificationCheck();
      setMessage(`Notification check complete. ${formatSummary(summary)}`);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="ds-card p-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">
          Notification scheduler
        </h2>
        <p className="mt-1 text-sm text-label">
          Board-only: run the same check Celery Beat runs every 30 minutes.
        </p>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => void handleRunCheck()}
          disabled={isRunning}
          className="rounded-full border border-gray-200 bg-surface-card px-4 py-2 text-sm text-foreground hover:border-accent disabled:opacity-60"
        >
          {isRunning ? "Running…" : "Run notification check now"}
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
    </section>
  );
}
