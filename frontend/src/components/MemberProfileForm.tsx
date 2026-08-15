import type { ReactNode } from "react";

import type { MemberResponse } from "../lib/auth-api";
import type { UpdateProfileRequest } from "../lib/members-api";
import type { ProfileFieldVisibility } from "../lib/member-talents";
import { SEMO_EMAIL_DOMAIN, getGraduationYearOptions } from "../lib/validation";
import { inputFieldClassName } from "./ui/Input";

export type MemberProfileFormValues = {
  full_name: string;
  email: string;
  major: string;
  graduation_year: string;
  interests: string;
  bio: string;
  phone: string;
  social_handle: string;
  email_visibility: ProfileFieldVisibility;
  phone_visibility: ProfileFieldVisibility;
  social_handle_visibility: ProfileFieldVisibility;
};

const graduationYears = getGraduationYearOptions();

export const profileInputClassName = `${inputFieldClassName} rounded-md`;

export function memberToProfileFormValues(
  member: MemberResponse,
): MemberProfileFormValues {
  return {
    full_name: member.full_name,
    email: member.email ?? "",
    major: member.major,
    graduation_year: String(member.graduation_year),
    interests: member.interests ?? "",
    bio: member.bio ?? "",
    phone: member.phone ?? "",
    social_handle: member.social_handle ?? "",
    email_visibility: member.email_visibility ?? "public",
    phone_visibility: member.phone_visibility ?? "board_only",
    social_handle_visibility: member.social_handle_visibility ?? "board_only",
  };
}

export function profileFormValuesToRequest(
  values: MemberProfileFormValues,
): UpdateProfileRequest {
  return {
    full_name: values.full_name.trim(),
    email: values.email,
    major: values.major.trim(),
    graduation_year: Number(values.graduation_year),
    interests: values.interests.trim() || null,
    bio: values.bio.trim() || null,
    phone: values.phone.trim() || null,
    social_handle: values.social_handle.trim() || null,
    email_visibility: values.email_visibility,
    phone_visibility: values.phone_visibility,
    social_handle_visibility: values.social_handle_visibility,
  };
}

type MemberProfileFormProps = {
  values: MemberProfileFormValues;
  studentId?: string | null;
  onChange: (values: MemberProfileFormValues) => void;
  idPrefix?: string;
};

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-field">
      {id ? (
        <label htmlFor={id}>{label}</label>
      ) : (
        <p className="settings-field-label">{label}</p>
      )}
      {children}
      {hint ? <p className="settings-field-hint">{hint}</p> : null}
    </div>
  );
}

export function MemberProfileForm({
  values,
  studentId,
  onChange,
  idPrefix = "profile",
}: MemberProfileFormProps) {
  function updateField<K extends keyof MemberProfileFormValues>(
    field: K,
    value: MemberProfileFormValues[K],
  ) {
    onChange({ ...values, [field]: value });
  }

  return (
    <div className="settings-form">
      <section className="settings-block">
        <h2 className="event-command-kicker">Identity</h2>
        <Field id={`${idPrefix}-full_name`} label="Full name">
          <input
            id={`${idPrefix}-full_name`}
            value={values.full_name}
            onChange={(event) => updateField("full_name", event.target.value)}
            className={profileInputClassName}
          />
        </Field>
        <Field
          id={`${idPrefix}-email`}
          label="Email"
          hint={`Must be your @${SEMO_EMAIL_DOMAIN} address`}
        >
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
            className={profileInputClassName}
          />
        </Field>
        {studentId ? (
          <Field label="Student ID">
            <p className="settings-readonly">{studentId}</p>
          </Field>
        ) : null}
        <Field id={`${idPrefix}-major`} label="Major">
          <input
            id={`${idPrefix}-major`}
            value={values.major}
            onChange={(event) => updateField("major", event.target.value)}
            className={profileInputClassName}
          />
        </Field>
        <Field id={`${idPrefix}-graduation_year`} label="Graduation year">
          <select
            id={`${idPrefix}-graduation_year`}
            value={values.graduation_year}
            onChange={(event) =>
              updateField("graduation_year", event.target.value)
            }
            className={profileInputClassName}
          >
            {graduationYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="settings-block">
        <h2 className="event-command-kicker">About</h2>
        <Field id={`${idPrefix}-interests`} label="Interests">
          <input
            id={`${idPrefix}-interests`}
            value={values.interests}
            onChange={(event) => updateField("interests", event.target.value)}
            placeholder="Hiking, coding, volleyball"
            className={profileInputClassName}
          />
        </Field>
        <Field id={`${idPrefix}-bio`} label="Bio">
          <textarea
            id={`${idPrefix}-bio`}
            rows={3}
            value={values.bio}
            onChange={(event) => updateField("bio", event.target.value)}
            className={profileInputClassName}
          />
        </Field>
      </section>

      <section className="settings-block">
        <h2 className="event-command-kicker">Contact</h2>
        <Field id={`${idPrefix}-phone`} label="Phone">
          <input
            id={`${idPrefix}-phone`}
            value={values.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            className={profileInputClassName}
          />
        </Field>
        <Field id={`${idPrefix}-social_handle`} label="Social handle">
          <input
            id={`${idPrefix}-social_handle`}
            value={values.social_handle}
            onChange={(event) =>
              updateField("social_handle", event.target.value)
            }
            placeholder="@username"
            className={profileInputClassName}
          />
        </Field>
      </section>
    </div>
  );
}
