export const SEMO_EMAIL_DOMAIN = "semo.edu";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSemoEmail(value: string): string {
  return value.toLowerCase().trim();
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

export const REGISTER_PASSWORD_MIN_LENGTH = 8;
export const REGISTER_PASSWORD_MAX_LENGTH = 128;
export const STUDENT_ID_PATTERN = /^\d{6,20}$/;

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

export function validateRegisterPassword(value: string): string | null {
  if (value.length < REGISTER_PASSWORD_MIN_LENGTH) {
    return "Password must be at least 8 characters";
  }

  if (value.length > REGISTER_PASSWORD_MAX_LENGTH) {
    return "Password must be at most 128 characters";
  }

  return null;
}

export function validateStudentId(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Student ID is required";
  }

  if (!STUDENT_ID_PATTERN.test(trimmed)) {
    return "Student ID must be 6-20 digits";
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

  const emailError = validateSemoEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  const passwordError = validateLoginPassword(values.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  return errors;
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

const registerValidators: Record<
  keyof RegisterFormValues,
  (value: string) => string | null
> = {
  full_name: validateFullName,
  email: validateSemoEmail,
  password: validateRegisterPassword,
  student_id: validateStudentId,
  major: validateMajor,
  graduation_year: validateGraduationYear,
};

export function validateRegisterForm(
  values: RegisterFormValues,
): RegisterFormErrors {
  const errors: RegisterFormErrors = {};

  for (const field of Object.keys(registerValidators) as Array<
    keyof RegisterFormValues
  >) {
    const error = registerValidators[field](values[field]);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

export function validateRegisterField(
  field: keyof RegisterFormValues,
  value: string,
): string | null {
  return registerValidators[field](value);
}
