import { useEffect, useState, type FormEvent } from "react";

import {
  MemberProfileForm,
  memberToProfileFormValues,
  profileFormValuesToRequest,
  type MemberProfileFormValues,
} from "../../components/MemberProfileForm";
import { ProfilePhotoCard } from "../../components/ProfilePhotoCard";
import { SettingsPageHeader } from "../../layouts/SettingsLayout";
import { useAuth } from "../../context/useAuth";
import { getApiErrorMessage } from "../../lib/api-error";
import { fetchMyProfile, updateMyProfile } from "../../lib/members-api";

export function SettingsProfilePage() {
  const { member, updateMember } = useAuth();
  const [values, setValues] = useState<MemberProfileFormValues | null>(() =>
    member ? memberToProfileFormValues(member) : null,
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const updatedMember = await updateMyProfile(profileFormValuesToRequest(values));
      updateMember(updatedMember);
      setValues(memberToProfileFormValues(updatedMember));
      setSuccessMessage("Profile updated.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="settings-page">
      <SettingsPageHeader
        title="Profile"
        description="How you appear in the directory."
      />

      {serverError ? (
        <p className="settings-status is-error" role="alert">
          {serverError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="settings-status" role="status">
          {successMessage}
        </p>
      ) : null}

      <ProfilePhotoCard
        member={member}
        onMemberUpdated={(updated) => {
          updateMember(updated);
          setValues(memberToProfileFormValues(updated));
        }}
      />

      <form onSubmit={(event) => void handleSubmit(event)}>
        {isLoading ? (
          <p className="settings-muted">Loading profile…</p>
        ) : (
          <MemberProfileForm
            values={values}
            studentId={member.student_id}
            onChange={setValues}
          />
        )}

        <div className="settings-actions">
          <button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="event-command-btn event-command-btn--primary"
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
