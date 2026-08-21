export const SEMO_EMAIL_DOMAIN = "semo.edu";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  getPasswordHint,
  validatePasswordStrength,
  type PasswordValidationContext,
} from "./password-validation";

export { getPasswordHint, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSemoEmail(value: string): string {
  return value.toLowerCase().trim();
}

export function validateEmailAddress(value: string): string | null {
  const email = value.trim().toLowerCase();

  if (!email) {
    return "Email is required";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address";
  }

  return null;
}

export function validateSemoEmail(value: string): string | null {
  const email = normalizeSemoEmail(value);

  if (!email) {
    return "Email is required";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "value is not a valid email address";
  }

  const domain = email.split("@").pop();
  if (domain !== SEMO_EMAIL_DOMAIN) {
    return `Email must be a @${SEMO_EMAIL_DOMAIN} address`;
  }

  return null;
}

export function validateLoginPassword(value: string): string | null {
  if (value.length < 1) {
    return "Password is required";
  }

  if (value.length > 128) {
    return "Password must be at most 128 characters";
  }

  return null;
}

export const REGISTER_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;
export const REGISTER_PASSWORD_MAX_LENGTH = PASSWORD_MAX_LENGTH;
export const STUDENT_ID_PATTERN = /^[A-Za-z0-9]{6,20}$/;

export function normalizeStudentId(value: string): string {
  return value.trim().toUpperCase();
}

const CURRENT_YEAR = new Date().getFullYear();
export const MAX_GRADUATION_YEAR = CURRENT_YEAR + 8;

export function getGraduationYearOptions(): number[] {
  return Array.from(
    { length: MAX_GRADUATION_YEAR - CURRENT_YEAR + 1 },
    (_, index) => CURRENT_YEAR + index,
  );
}

export function validateFullName(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Full name is required";
  }

  if (trimmed.length > 255) {
    return "Full name must be at most 255 characters";
  }

  return null;
}

export function validateRegisterPassword(
  value: string,
  context: PasswordValidationContext = {},
): string | null {
  return validatePasswordStrength(value, context);
}

export function validateStudentId(value: string): string | null {
  const studentId = normalizeStudentId(value);

  if (!studentId) {
    return "Student ID is required";
  }

  if (!STUDENT_ID_PATTERN.test(studentId)) {
    return "Student ID must be 6-20 letters or numbers";
  }

  return null;
}

export function validateMajor(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Major is required";
  }

  if (trimmed.length > 255) {
    return "Major must be at most 255 characters";
  }

  return null;
}

export function validateGraduationYear(value: string): string | null {
  if (!value.trim()) {
    return "Graduation year is required";
  }

  const year = Number(value);

  if (!Number.isInteger(year)) {
    return "Graduation year must be a valid year";
  }

  if (year < CURRENT_YEAR || year > MAX_GRADUATION_YEAR) {
    return `Graduation year must be between ${CURRENT_YEAR} and ${MAX_GRADUATION_YEAR}`;
  }

  return null;
}

export type LoginFormValues = {
  email: string;
  password: string;
};

export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {};

  const emailError = validateEmailAddress(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  const passwordError = validateLoginPassword(values.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  return errors;
}

export function validateRegisterEmail(value: string): string | null {
  return validateEmailAddress(value);
}

export function validateRegisterStudentId(
  value: string,
  email: string,
): string | null {
  const domain = normalizeSemoEmail(email).split("@").pop();
  if (domain !== SEMO_EMAIL_DOMAIN) {
    // Org-owner allowlist accounts may omit student ID; backend enforces.
    if (!value.trim()) {
      return null;
    }
  }
  return validateStudentId(value);
}

export type RegisterFormValues = {
  full_name: string;
  email: string;
  password: string;
  student_id: string;
  major: string;
  graduation_year: string;
};

export type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>>;

export function validateRegisterForm(
  values: RegisterFormValues,
): RegisterFormErrors {
  const errors: RegisterFormErrors = {};

  const fullNameError = validateFullName(values.full_name);
  if (fullNameError) {
    errors.full_name = fullNameError;
  }

  const emailError = validateRegisterEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  const studentIdError = validateRegisterStudentId(
    values.student_id,
    values.email,
  );
  if (studentIdError) {
    errors.student_id = studentIdError;
  }

  const majorError = validateMajor(values.major);
  if (majorError) {
    errors.major = majorError;
  }

  const yearError = validateGraduationYear(values.graduation_year);
  if (yearError) {
    errors.graduation_year = yearError;
  }

  const passwordError = validateRegisterPassword(values.password, {
    email: values.email,
    fullName: values.full_name,
  });
  if (passwordError) {
    errors.password = passwordError;
  }

  return errors;
}

export function validateRegisterField(
  field: keyof RegisterFormValues,
  value: string,
  values?: RegisterFormValues,
): string | null {
  if (field === "password") {
    return validateRegisterPassword(value, {
      email: values?.email,
      fullName: values?.full_name,
    });
  }
  if (field === "email") {
    return validateRegisterEmail(value);
  }
  if (field === "student_id") {
    return validateRegisterStudentId(value, values?.email ?? "");
  }
  if (field === "full_name") {
    return validateFullName(value);
  }
  if (field === "major") {
    return validateMajor(value);
  }
  if (field === "graduation_year") {
    return validateGraduationYear(value);
  }
  return null;
}

export type ProfileFormValues = {
  full_name: string;
  email: string;
  major: string;
  graduation_year: string;
};

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

const profileValidators: Record<
  keyof ProfileFormValues,
  (value: string) => string | null
> = {
  full_name: validateFullName,
  email: validateSemoEmail,
  major: validateMajor,
  graduation_year: validateGraduationYear,
};

export function validateProfileForm(
  values: ProfileFormValues,
): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  for (const field of Object.keys(profileValidators) as Array<
    keyof ProfileFormValues
  >) {
    const error = profileValidators[field](values[field]);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

export function validateProfileField(
  field: keyof ProfileFormValues,
  value: string,
): string | null {
  return profileValidators[field](value);
}
