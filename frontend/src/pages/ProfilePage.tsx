import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { RoleBadge } from "../components/RoleBadge";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/useAuth";
import { getApiErrorMessage } from "../lib/auth-api";
import { fetchMyProfile, updateMyProfile } from "../lib/members-api";
import { getDashboardPath } from "../lib/roles";
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
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          My profile
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">{member.full_name}</h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          View and update your contact information. Student ID and role are
          managed by NSA board.
        </p>
        <Link
          to={getDashboardPath(member.role)}
          className="mt-4 inline-block text-sm font-medium text-accent hover:text-accent-hover"
        >
          Back to dashboard
        </Link>
      </section>

      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="rounded-lg border border-gray-200 bg-white p-6"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4">
          <h2 className="text-lg font-semibold text-primary">Contact info</h2>
          <RoleBadge role={member.role} size="md" />
          <StatusBadge status={member.status} />
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-gray-500">Loading profile...</p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
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
                <p className="mt-1 text-sm text-red-600">{fieldErrors.full_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
              <p className="mt-1 text-xs text-gray-500">
                Must be your @{SEMO_EMAIL_DOMAIN} address
              </p>
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="major" className="block text-sm font-medium text-gray-700">
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
                <p className="mt-1 text-sm text-red-600">{fieldErrors.major}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="graduation_year"
                className="block text-sm font-medium text-gray-700"
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
                <p className="mt-1 text-sm text-red-600">
                  {fieldErrors.graduation_year}
                </p>
              )}
            </div>

            <div>
              <p className="block text-sm font-medium text-gray-700">Student ID</p>
              <p className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {member.student_id}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
