/**
 * Invite Member form values and client-side validation (UX only).
 */

export const INVITE_DRAFT_STORAGE_KEY = "nsa-connect.invite-member.draft";

export type InviteFormValues = {
  firstName: string;
  lastName: string;
  organization: string;
  role: string;
  committee: string;
  graduationYear: string;
  email: string;
  phone: string;
};

export type InviteFormErrors = Partial<Record<keyof InviteFormValues, string>>;

export const EMPTY_INVITE_FORM: InviteFormValues = {
  firstName: "",
  lastName: "",
  organization: "",
  role: "",
  committee: "",
  graduationYear: "",
  email: "",
  phone: "",
};

export const INVITE_FIELD_ORDER: (keyof InviteFormValues)[] = [
  "firstName",
  "lastName",
  "organization",
  "role",
  "committee",
  "graduationYear",
  "email",
  "phone",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 0 || (digits.length >= 10 && digits.length <= 15);
}

function validateName(value: string, label: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${label} is required.`;
  }
  if (trimmed.length < 2) {
    return `${label} must be at least 2 characters.`;
  }
  if (trimmed.length > 60) {
    return `${label} must be 60 characters or fewer.`;
  }
  return undefined;
}

export function validateInviteField(
  key: keyof InviteFormValues,
  values: InviteFormValues,
): string | undefined {
  switch (key) {
    case "firstName":
      return validateName(values.firstName, "First name");
    case "lastName":
      return validateName(values.lastName, "Last name");
    case "organization":
      if (!values.organization) {
        return "Select an organization.";
      }
      return undefined;
    case "role":
      if (!values.role) {
        return "Choose a role for this invitation.";
      }
      return undefined;
    case "committee":
      return undefined;
    case "graduationYear":
      if (!values.graduationYear) {
        return "Select an expected graduation year.";
      }
      return undefined;
    case "email": {
      const email = values.email.trim();
      if (!email) {
        return "Email is required.";
      }
      if (!isValidEmail(email)) {
        return "Enter a valid email address.";
      }
      return undefined;
    }
    case "phone":
      if (values.phone.trim() && !isValidPhone(values.phone)) {
        return "Enter a phone number with 10–15 digits.";
      }
      return undefined;
    default:
      return undefined;
  }
}

export function validateInviteForm(values: InviteFormValues): InviteFormErrors {
  const errors: InviteFormErrors = {};
  for (const key of INVITE_FIELD_ORDER) {
    const message = validateInviteField(key, values);
    if (message) {
      errors[key] = message;
    }
  }
  return errors;
}

export function firstInviteErrorField(
  errors: InviteFormErrors,
): keyof InviteFormValues | null {
  for (const key of INVITE_FIELD_ORDER) {
    if (errors[key]) {
      return key;
    }
  }
  return null;
}

export function loadInviteDraft(): InviteFormValues | null {
  try {
    const raw = window.localStorage.getItem(INVITE_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<InviteFormValues>;
    return { ...EMPTY_INVITE_FORM, ...parsed };
  } catch {
    return null;
  }
}

export function saveInviteDraft(values: InviteFormValues): void {
  window.localStorage.setItem(INVITE_DRAFT_STORAGE_KEY, JSON.stringify(values));
}

export function clearInviteDraft(): void {
  window.localStorage.removeItem(INVITE_DRAFT_STORAGE_KEY);
}
