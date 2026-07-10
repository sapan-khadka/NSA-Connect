import type { MemberResponse } from "../lib/auth-api";
import type { UpdateProfileRequest } from "../lib/members-api";
import {
  MEMBER_TALENT_LABELS,
  MEMBER_TALENTS,
  type ProfileFieldVisibility,
} from "../lib/member-talents";
import { SEMO_EMAIL_DOMAIN, getGraduationYearOptions } from "../lib/validation";
import { Card } from "./ui/Card";
import { inputFieldClassName } from "./ui/Input";

export type MemberProfileFormValues = {
  full_name: string;
  email: string;
  major: string;
  graduation_year: string;
  interests: string;
  bio: string;
  talents: string[];
  talent_other: string;
  phone: string;
  social_handle: string;
  email_visibility: ProfileFieldVisibility;
  phone_visibility: ProfileFieldVisibility;
  social_handle_visibility: ProfileFieldVisibility;
};

const graduationYears = getGraduationYearOptions();

export const profileInputClassName = `${inputFieldClassName} mt-1 rounded-md`;

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
    talents: member.talents ?? [],
    talent_other: member.talent_other ?? "",
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
    talents: values.talents,
    talent_other: values.talents.includes("other")
      ? values.talent_other.trim() || null
      : null,
    phone: values.phone.trim() || null,
    social_handle: values.social_handle.trim() || null,
    email_visibility: values.email_visibility,
    phone_visibility: values.phone_visibility,
    social_handle_visibility: values.social_handle_visibility,
  };
}

type VisibilityToggleProps = {
  label: string;
  value: ProfileFieldVisibility;
  onChange: (value: ProfileFieldVisibility) => void;
};

function VisibilityToggle({ label, value, onChange }: VisibilityToggleProps) {
  return (
    <fieldset className="mt-2">
      <legend className="text-xs text-label">{label} visibility</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {(["public", "board_only"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={[
              "ds-chip",
              value === option
                ? "bg-primary text-white"
                : "bg-[#F5F5F7] text-label hover:text-foreground",
            ].join(" ")}
          >
            {option === "public" ? "Public" : "Board only"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type MemberProfileFormProps = {
  values: MemberProfileFormValues;
  studentId?: string | null;
  onChange: (values: MemberProfileFormValues) => void;
  idPrefix?: string;
};

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

  function toggleTalent(talent: string) {
    const next = values.talents.includes(talent)
      ? values.talents.filter((item) => item !== talent)
      : [...values.talents, talent];
    updateField("talents", next);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <label htmlFor={`${idPrefix}-full_name`} className="block text-sm font-medium text-foreground">
          Full name
        </label>
        <input
          id={`${idPrefix}-full_name`}
          value={values.full_name}
          onChange={(event) => updateField("full_name", event.target.value)}
          className={profileInputClassName}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-email`} className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          value={values.email}
          onChange={(event) => updateField("email", event.target.value)}
          className={profileInputClassName}
        />
        <p className="mt-1 text-xs text-label">Must be your @{SEMO_EMAIL_DOMAIN} address</p>
        <VisibilityToggle
          label="Email"
          value={values.email_visibility}
          onChange={(next) => updateField("email_visibility", next)}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-major`} className="block text-sm font-medium text-foreground">
          Major
        </label>
        <input
          id={`${idPrefix}-major`}
          value={values.major}
          onChange={(event) => updateField("major", event.target.value)}
          className={profileInputClassName}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-graduation_year`} className="block text-sm font-medium text-foreground">
          Graduation year
        </label>
        <select
          id={`${idPrefix}-graduation_year`}
          value={values.graduation_year}
          onChange={(event) => updateField("graduation_year", event.target.value)}
          className={profileInputClassName}
        >
          {graduationYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {studentId ? (
        <div>
          <p className="block text-sm font-medium text-foreground">Student ID</p>
          <Card
            as="p"
            nested
            padding="none"
            className="mt-1 px-3 py-2 text-sm text-label"
          >
            {studentId}
          </Card>
        </div>
      ) : null}

      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-interests`} className="block text-sm font-medium text-foreground">
          Interests
        </label>
        <input
          id={`${idPrefix}-interests`}
          value={values.interests}
          onChange={(event) => updateField("interests", event.target.value)}
          placeholder="hiking, coding, volleyball"
          className={profileInputClassName}
        />
      </div>

      <div className="md:col-span-2">
        <label htmlFor={`${idPrefix}-bio`} className="block text-sm font-medium text-foreground">
          Short bio
        </label>
        <textarea
          id={`${idPrefix}-bio`}
          rows={4}
          value={values.bio}
          onChange={(event) => updateField("bio", event.target.value)}
          className={profileInputClassName}
        />
      </div>

      <div className="md:col-span-2">
        <p className="text-sm font-medium text-foreground">Talents</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MEMBER_TALENTS.map((talent) => {
            const selected = values.talents.includes(talent);
            return (
              <button
                key={talent}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTalent(talent)}
                className={[
                  "ds-chip",
                  selected
                    ? "bg-primary text-white"
                    : "border border-gray-200 bg-white text-label hover:text-foreground",
                ].join(" ")}
              >
                {MEMBER_TALENT_LABELS[talent]}
              </button>
            );
          })}
        </div>
        {values.talents.includes("other") ? (
          <input
            aria-label="Other talent description"
            value={values.talent_other}
            onChange={(event) => updateField("talent_other", event.target.value)}
            placeholder="Describe your other talent"
            className={`${profileInputClassName} mt-3`}
          />
        ) : null}
      </div>

      <div>
        <label htmlFor={`${idPrefix}-phone`} className="block text-sm font-medium text-foreground">
          Phone
        </label>
        <input
          id={`${idPrefix}-phone`}
          value={values.phone}
          onChange={(event) => updateField("phone", event.target.value)}
          className={profileInputClassName}
        />
        <VisibilityToggle
          label="Phone"
          value={values.phone_visibility}
          onChange={(next) => updateField("phone_visibility", next)}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-social_handle`} className="block text-sm font-medium text-foreground">
          Social handle
        </label>
        <input
          id={`${idPrefix}-social_handle`}
          value={values.social_handle}
          onChange={(event) => updateField("social_handle", event.target.value)}
          placeholder="@username"
          className={profileInputClassName}
        />
        <VisibilityToggle
          label="Social handle"
          value={values.social_handle_visibility}
          onChange={(next) => updateField("social_handle_visibility", next)}
        />
      </div>
    </div>
  );
}
