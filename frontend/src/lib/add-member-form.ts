/**
 * Add Member form values and client-side validation.
 */

export const ADD_MEMBER_DRAFT_STORAGE_KEY = "nsa-connect.add-member.draft";
/** Legacy key from the previous Invite Member flow. */
const LEGACY_INVITE_DRAFT_STORAGE_KEY = "nsa-connect.invite-member.draft";

export type AddMemberFormValues = {
  firstName: string;
  lastName: string;
  studentId: string;
  major: string;
  graduationYear: string;
  email: string;
  phone: string;
};

export type AddMemberFormErrors = Partial<
  Record<keyof AddMemberFormValues, string>
>;

export const EMPTY_ADD_MEMBER_FORM: AddMemberFormValues = {
  firstName: "",
  lastName: "",
  studentId: "",
  major: "",
  graduationYear: "",
  email: "",
  phone: "",
};

export const ADD_MEMBER_FIELD_ORDER: (keyof AddMemberFormValues)[] = [
  "firstName",
  "lastName",
  "email",
  "studentId",
  "major",
  "graduationYear",
  "phone",
];

const EMAIL_PATTERN = /^[^\s@]+@semo\.edu$/i;
const STUDENT_ID_PATTERN = /^[A-Z0-9]{6,20}$/;

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

export function validateAddMemberField(
  key: keyof AddMemberFormValues,
  values: AddMemberFormValues,
): string | undefined {
  switch (key) {
    case "firstName":
      return validateName(values.firstName, "First name");
    case "lastName":
      return validateName(values.lastName, "Last name");
    case "studentId": {
      const studentId = values.studentId.trim().toUpperCase();
      if (!studentId) {
        return "Student ID is required.";
      }
      if (!STUDENT_ID_PATTERN.test(studentId)) {
        return "Student ID must be 6–20 letters or numbers.";
      }
      return undefined;
    }
    case "major":
      if (!values.major.trim()) {
        return "Major is required.";
      }
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
      if (!EMAIL_PATTERN.test(email)) {
        return "Email must be a @semo.edu address.";
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

export function validateAddMemberForm(
  values: AddMemberFormValues,
): AddMemberFormErrors {
  const errors: AddMemberFormErrors = {};
  for (const key of ADD_MEMBER_FIELD_ORDER) {
    const message = validateAddMemberField(key, values);
    if (message) {
      errors[key] = message;
    }
  }
  return errors;
}

export function firstAddMemberErrorField(
  errors: AddMemberFormErrors,
): keyof AddMemberFormValues | null {
  for (const key of ADD_MEMBER_FIELD_ORDER) {
    if (errors[key]) {
      return key;
    }
  }
  return null;
}

export function loadAddMemberDraft(): AddMemberFormValues | null {
  try {
    const raw =
      window.localStorage.getItem(ADD_MEMBER_DRAFT_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_INVITE_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AddMemberFormValues>;
    return { ...EMPTY_ADD_MEMBER_FORM, ...parsed };
  } catch {
    return null;
  }
}

export function saveAddMemberDraft(values: AddMemberFormValues): void {
  window.localStorage.setItem(
    ADD_MEMBER_DRAFT_STORAGE_KEY,
    JSON.stringify(values),
  );
  window.localStorage.removeItem(LEGACY_INVITE_DRAFT_STORAGE_KEY);
}

export function clearAddMemberDraft(): void {
  window.localStorage.removeItem(ADD_MEMBER_DRAFT_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_INVITE_DRAFT_STORAGE_KEY);
}
