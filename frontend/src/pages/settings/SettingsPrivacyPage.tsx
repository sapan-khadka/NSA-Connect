import { useEffect, useState } from "react";

import { SettingsPageHeader } from "../../layouts/SettingsLayout";
import { useAuth } from "../../context/useAuth";
import { getApiErrorMessage } from "../../lib/api-error";
import { fetchMyProfile, updateMyProfile } from "../../lib/members-api";
import type { ProfileFieldVisibility } from "../../lib/member-talents";
import {
  memberToProfileFormValues,
  type MemberProfileFormValues,
} from "../../components/MemberProfileForm";

const VISIBILITY_OPTIONS: { id: ProfileFieldVisibility; label: string }[] = [
  { id: "public", label: "Public" },
  { id: "board_only", label: "Board only" },
];

type VisibilityKey =
  | "email_visibility"
  | "phone_visibility"
  | "social_handle_visibility";

function VisibilityRow({
  title,
  value,
  saving,
  onChange,
}: {
  title: string;
  value: ProfileFieldVisibility;
  saving: boolean;
  onChange: (value: ProfileFieldVisibility) => void;
}) {
  return (
    <div className="settings-row">
      <p className="settings-row-title">{title}</p>
      <div
        className="settings-choice"
        role="group"
        aria-label={`${title} visibility`}
      >
        {VISIBILITY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            disabled={saving}
            onClick={() => {
              if (value !== option.id) {
                onChange(option.id);
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPrivacyPage() {
  const { member, updateMember } = useAuth();
  const [values, setValues] = useState<MemberProfileFormValues | null>(() =>
    member ? memberToProfileFormValues(member) : null,
  );
  const [savingKey, setSavingKey] = useState<VisibilityKey | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchMyProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }
        updateMember(profile);
        setValues(memberToProfileFormValues(profile));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setServerError(getApiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [updateMember]);

  if (!member || !values) {
    return null;
  }

  async function handleChange(
    key: VisibilityKey,
    next: ProfileFieldVisibility,
  ) {
    if (!values || savingKey !== null) {
      return;
    }

    const previous = values;
    setValues({ ...values, [key]: next });
    setSavingKey(key);
    setServerError(null);

    try {
      const updatedMember = await updateMyProfile({ [key]: next });
      updateMember(updatedMember);
      setValues(memberToProfileFormValues(updatedMember));
    } catch (error) {
      setValues(previous);
      setServerError(getApiErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="settings-page">
      <SettingsPageHeader
        title="Privacy"
        description="Who sees your contact details in the directory."
      />

      {serverError ? (
        <p className="settings-status is-error" role="alert">
          {serverError}
        </p>
      ) : null}

      {isLoading ? (
        <p className="settings-muted">Loading privacy settings…</p>
      ) : (
        <section className="settings-block is-flush">
          <h2 className="event-command-kicker">Visibility</h2>
          <VisibilityRow
            title="Email"
            value={values.email_visibility}
            saving={savingKey === "email_visibility"}
            onChange={(next) => void handleChange("email_visibility", next)}
          />
          <VisibilityRow
            title="Phone"
            value={values.phone_visibility}
            saving={savingKey === "phone_visibility"}
            onChange={(next) => void handleChange("phone_visibility", next)}
          />
          <VisibilityRow
            title="Social handle"
            value={values.social_handle_visibility}
            saving={savingKey === "social_handle_visibility"}
            onChange={(next) =>
              void handleChange("social_handle_visibility", next)
            }
          />
        </section>
      )}
    </div>
  );
}
