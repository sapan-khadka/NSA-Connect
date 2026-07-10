import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/auth-api";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "../lib/notifications-api";
import { Card } from "./ui/Card";

type PreferenceKey = keyof NotificationPreferences;

const PREFERENCE_OPTIONS: {
  key: PreferenceKey;
  label: string;
  description: string;
}[] = [
  {
    key: "event_reminders",
    label: "Event reminders",
    description: "Upcoming events you may want to attend.",
  },
  {
    key: "rsvp_nudges",
    label: "RSVP nudges",
    description: "Prompts to respond when you have not RSVP'd yet.",
  },
  {
    key: "task_reminders",
    label: "Task assigned/due reminders",
    description: "Alerts when tasks are assigned to you or coming due.",
  },
  {
    key: "dues_reminders",
    label: "Dues reminders",
    description: "Friendly reminders when semester membership dues are outstanding.",
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "Board broadcasts and club-wide updates.",
  },
];

export function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loadingKey, setLoadingKey] = useState<PreferenceKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      try {
        const response = await fetchNotificationPreferences();
        if (!cancelled) {
          setPreferences(response);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error));
        }
      }
    }

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle(key: PreferenceKey) {
    if (!preferences || loadingKey !== null) {
      return;
    }

    const nextValue = !preferences[key];
    const previous = preferences;
    setPreferences({ ...preferences, [key]: nextValue });
    setLoadingKey(key);
    setErrorMessage(null);

    try {
      const updated = await updateNotificationPreferences({ [key]: nextValue });
      setPreferences(updated);
    } catch (error) {
      setPreferences(previous);
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <Card padding="none" className="p-4 sm:p-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-light tracking-subhead text-foreground">
          Notifications
        </h2>
        <p className="mt-1 text-sm text-label">
          Choose which email notifications you want to receive. Changes save immediately.
        </p>
      </div>

      {errorMessage ? (
        <p className="mt-4 text-sm text-overdue" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!preferences ? (
        <p className="mt-6 text-sm text-label">Loading notification preferences…</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {PREFERENCE_OPTIONS.map((option) => {
            const isOn = preferences[option.key];
            const isSaving = loadingKey === option.key;

            return (
              <li
                key={option.key}
                className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-surface-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="mt-1 text-sm text-label">{option.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  aria-label={`${option.label} ${isOn ? "on" : "off"}`}
                  disabled={isSaving}
                  onClick={() => void handleToggle(option.key)}
                  className={[
                    "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors",
                    isOn ? "bg-primary" : "bg-gray-200",
                    isSaving ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform",
                      isOn ? "translate-x-7" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
