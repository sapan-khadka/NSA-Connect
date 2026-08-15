import { useEffect, useState } from "react";

import { getApiErrorMessage } from "../lib/api-error";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "../lib/notifications-api";

type PreferenceKey = keyof NotificationPreferences;

type PreferenceOption = {
  key: PreferenceKey;
  label: string;
  description: string;
};

type PreferenceGroup = {
  id: string;
  label: string;
  options: PreferenceOption[];
};

const PREFERENCE_GROUPS: PreferenceGroup[] = [
  {
    id: "events",
    label: "Events",
    options: [
      {
        key: "event_reminders",
        label: "Event reminders",
        description: "Before events you may attend.",
      },
      {
        key: "rsvp_nudges",
        label: "RSVP updates",
        description: "When an event you responded to changes.",
      },
    ],
  },
  {
    id: "work",
    label: "Tasks",
    options: [
      {
        key: "task_reminders",
        label: "Task reminders",
        description: "Assignments and deadlines.",
      },
    ],
  },
  {
    id: "organization",
    label: "Chapter",
    options: [
      {
        key: "dues_reminders",
        label: "Dues reminders",
        description: "Outstanding membership dues.",
      },
      {
        key: "announcements",
        label: "Announcements",
        description: "Board and chapter notices.",
      },
    ],
  },
];

export function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(
    null,
  );
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
    <div>
      {errorMessage ? (
        <p className="settings-status is-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!preferences ? (
        <p className="settings-muted">Loading notification preferences…</p>
      ) : (
        <>
          {PREFERENCE_GROUPS.map((group, index) => (
            <section
              key={group.id}
              className={
                index === 0 ? "settings-block is-flush" : "settings-block"
              }
            >
              <h2 className="event-command-kicker">{group.label}</h2>
              {group.options.map((option) => {
                const isOn = preferences[option.key];
                const isSaving = loadingKey === option.key;
                return (
                  <div key={option.key} className="settings-row">
                    <div>
                      <p className="settings-row-title">{option.label}</p>
                      <p className="settings-row-desc">{option.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      aria-label={`${option.label} ${isOn ? "on" : "off"}`}
                      disabled={isSaving}
                      onClick={() => void handleToggle(option.key)}
                      className={[
                        "settings-onoff",
                        isOn ? "is-on" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {isOn ? "On" : "Off"}
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
