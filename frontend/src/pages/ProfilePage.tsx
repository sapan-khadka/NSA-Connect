import { useEffect, useState, type FormEvent } from "react";

import { AdminNotificationCheckButton } from "../components/AdminNotificationCheckButton";
import { AdminTestEmailButton } from "../components/AdminTestEmailButton";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { NotificationPreferencesSection } from "../components/NotificationPreferencesSection";
import {
  MemberProfileForm,
  memberToProfileFormValues,
  profileFormValuesToRequest,
  type MemberProfileFormValues,
} from "../components/MemberProfileForm";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/api-error";
import { fetchMyProfile, updateMyProfile } from "../lib/members-api";
import { isRoleAtLeast } from "../lib/roles";
import { MemberDuesStatus } from "../components/MemberDuesStatus";
import { RoleBadge } from "../components/RoleBadge";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function ProfilePage() {
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

  const canSendTestEmail = isRoleAtLeast(member.role, "board");

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
      setSuccessMessage("Profile updated successfully.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card padding="none" className="p-4 sm:p-8">
        <p className="ds-section-label">Account settings</p>
        <h1 className="mt-2 text-3xl font-light tracking-headline text-foreground">
          {member.full_name}
        </h1>
        <p className="mt-3 max-w-2xl text-label">
          Share your talents and interests so organizers can find you for cultural programs.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <RoleBadge role={member.role} size="md" />
          <StatusBadge status={member.status} />
          <MemberDuesStatus />
        </div>
      </Card>

      {serverError ? <div className="ds-alert-banner">{serverError}</div> : null}

      {successMessage ? (
        <Card
          as="div"
          padding="none"
          className="rounded-lg px-4 py-3 text-sm text-primary"
        >
          {successMessage}
        </Card>
      ) : null}

      <Card
        as="form"
        onSubmit={(event) => void handleSubmit(event)}
        padding="none"
        className="p-4 sm:p-6"
      >
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-lg font-light tracking-subhead text-foreground">
            Profile & contact
          </h2>
          <p className="mt-1 text-sm text-label">
            Control who can see sensitive contact fields in the member directory.
          </p>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-label">Loading profile...</p>
        ) : (
          <div className="mt-6">
            <MemberProfileForm
              values={values}
              studentId={member.student_id}
              onChange={setValues}
            />
          </div>
        )}

        <div className="mt-8 flex justify-stretch sm:justify-end">
          <Button
            type="submit"
            disabled={isLoading || isSubmitting}
            loading={isSubmitting}
            size="lg"
            className="w-full sm:w-auto"
          >
            Save changes
          </Button>
        </div>
      </Card>

      <NotificationPreferencesSection />

      {canSendTestEmail ? (
        <>
          <AdminTestEmailButton />
          <AdminNotificationCheckButton />
        </>
      ) : null}

      <ChangePasswordForm
        email={member?.email ?? undefined}
        fullName={member?.full_name}
      />
    </div>
  );
}
