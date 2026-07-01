import { useEffect, useState, type FormEvent } from "react";

import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMyProfile, updateMyProfile } from "../lib/members-api";
import { RoleBadge } from "../components/RoleBadge";
import { StatusBadge } from "../components/StatusBadge";
import {
  SEMO_EMAIL_DOMAIN,
  getGraduationYearOptions,
  validateProfileField,
  validateProfileForm,
  type ProfileFormErrors,
  type ProfileFormValues,
} from "../lib/validation";

const graduationYears = getGraduationYearOptions();

const inputClassName =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function memberToFormValues(member: NonNullable<ReturnType<typeof useAuth>["member"]>): ProfileFormValues {
  return {
    full_name: member.full_name,
    email: member.email,
    major: member.major,
    graduation_year: String(member.graduation_year),
  };
}

export function ProfilePage() {
  const { member, updateMember } = useAuth();
  const [values, setValues] = useState<ProfileFormValues | null>(() =>
    member ? memberToFormValues(member) : null,
  );
  const [fieldErrors, setFieldErrors] = useState<ProfileFormErrors>({});
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
        setValues(memberToFormValues(profile));
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

  function updateField<K extends keyof ProfileFormValues>(
    field: K,
    value: ProfileFormValues[K],
  ) {
    setValues((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setSuccessMessage(null);
  }

  function validateField(field: keyof ProfileFormValues) {
    const currentValues = values;
    if (!currentValues) {
      return;
    }

    const error = validateProfileField(field, currentValues[field]);

    setFieldErrors((current) => ({
      ...current,
      [field]: error ?? undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const currentValues = values;
    if (!currentValues) {
      return;
    }

    const errors = validateProfileForm(currentValues);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const updatedMember = await updateMyProfile({
        full_name: currentValues.full_name.trim(),
        email: currentValues.email,
        major: currentValues.major.trim(),
        graduation_year: Number(currentValues.graduation_year),
      });
      updateMember(updatedMember);
      setValues(memberToFormValues(updatedMember));
      setSuccessMessage("Profile updated successfully.");
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="ds-card p-8">
        <p className="ds-section-label">
          Account settings
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-headline text-foreground">{member.full_name}</h1>
        <p className="mt-3 max-w-2xl text-label">
          Manage your contact information, password, and membership details in
          one place.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <RoleBadge role={member.role} size="md" />
          <StatusBadge status={member.status} />
        </div>
      </section>

      {serverError && (
        <div className="ds-alert-banner">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg ds-card px-4 py-3 text-sm text-primary">
          {successMessage}
        </div>
      )}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="ds-card p-6"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4">
          <h2 className="text-lg font-light tracking-subhead text-foreground">Contact info</h2>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-label">Loading profile...</p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-foreground">
                Full name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={values.full_name}
                onChange={(event) => updateField("full_name", event.target.value)}
                onBlur={() => validateField("full_name")}
                className={inputClassName}
              />
              {fieldErrors.full_name && (
                <p className="mt-1 ds-field-error">{fieldErrors.full_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                onBlur={() => validateField("email")}
                className={inputClassName}
              />
              <p className="mt-1 text-xs text-label">
                Must be your @{SEMO_EMAIL_DOMAIN} address
              </p>
              {fieldErrors.email && (
                <p className="mt-1 ds-field-error">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="major" className="block text-sm font-medium text-foreground">
                Major
              </label>
              <input
                id="major"
                name="major"
                type="text"
                value={values.major}
                onChange={(event) => updateField("major", event.target.value)}
                onBlur={() => validateField("major")}
                className={inputClassName}
              />
              {fieldErrors.major && (
                <p className="mt-1 ds-field-error">{fieldErrors.major}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="graduation_year"
                className="block text-sm font-medium text-foreground"
              >
                Graduation year
              </label>
              <select
                id="graduation_year"
                name="graduation_year"
                value={values.graduation_year}
                onChange={(event) =>
                  updateField("graduation_year", event.target.value)
                }
                onBlur={() => validateField("graduation_year")}
                className={inputClassName}
              >
                {graduationYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {fieldErrors.graduation_year && (
                <p className="mt-1 ds-field-error">
                  {fieldErrors.graduation_year}
                </p>
              )}
            </div>

            <div>
              <p className="block text-sm font-medium text-foreground">Student ID</p>
              <p className="mt-1 ds-card-nested px-3 py-2 text-sm text-label">
                {member.student_id}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      <ChangePasswordForm />
    </div>
  );
}
