/** Keep in sync with backend/app/core/password_validation.py */
export const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password1",
    "password12",
    "password123",
    "123456",
    "1234567",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty",
    "qwerty123",
    "qwertyuiop",
    "abc123",
    "abc12345",
    "111111",
    "000000",
    "123123",
    "654321",
    "666666",
    "7777777",
    "888888",
    "999999",
    "iloveyou",
    "princess",
    "admin",
    "admin123",
    "welcome",
    "welcome1",
    "welcome123",
    "letmein",
    "login",
    "master",
    "hello",
    "hello123",
    "football",
    "baseball",
    "soccer",
    "monkey",
    "dragon",
    "shadow",
    "sunshine",
    "ashley",
    "bailey",
    "passw0rd",
    "trustno1",
    "superman",
    "batman",
    "starwars",
    "access",
    "flower",
    "hockey",
    "killer",
    "pepper",
    "jordan",
    "hunter",
    "ranger",
    "buster",
    "thomas",
    "robert",
    "daniel",
    "joshua",
    "michael",
    "charlie",
    "andrew",
    "matthew",
    "jennifer",
    "jessica",
    "nicole",
    "amanda",
    "samantha",
    "summer",
    "winter",
    "spring",
    "autumn",
    "mustang",
    "corvette",
    "ferrari",
    "porsche",
    "mercedes",
    "computer",
    "internet",
    "google",
    "apple",
    "samsung",
    "microsoft",
    "changeme",
    "default",
    "secret",
    "secret123",
    "test",
    "test123",
    "testing",
    "testing123",
    "guest",
    "guest123",
    "root",
    "toor",
    "pass",
    "pass123",
    "pass1234",
    "qazwsx",
    "zaq12wsx",
    "1q2w3e4r",
    "1qaz2wsx",
    "asdfgh",
    "asdfghjkl",
    "zxcvbn",
    "zxcvbnm",
    "qweasd",
    "qweasdzxc",
    "password!",
    "p@ssw0rd",
    "p@ssword",
    "Password1",
    "Password123",
    "Qwerty123",
    "iloveyou1",
    "whatever",
    "nothing",
    "unknown",
    "freedom",
    "forever",
    "cookie",
    "cheese",
    "chocolate",
    "coffee",
    "purple",
    "yellow",
    "orange",
    "silver",
    "golden",
    "diamond",
    "thunder",
    "lightning",
    "rainbow",
    "unicorn",
    "pokemon",
    "minecraft",
    "fortnite",
    "semo",
    "semo123",
    "semo1234",
    "college",
    "college1",
    "student",
    "student1",
    "university",
  ].map((password) => password.toLowerCase()),
);

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordValidationContext = {
  email?: string;
  fullName?: string;
};

function emailLocalPart(email: string): string {
  return email.split("@", 1)[0]?.toLowerCase().trim() ?? "";
}

function nameTokens(fullName: string): string[] {
  const matches = fullName.match(/[A-Za-z]+/g) ?? [];
  return matches.filter((token) => token.length >= 3).map((token) => token.toLowerCase());
}

export function validatePasswordStrength(
  password: string,
  context: PasswordValidationContext = {},
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "Password must be at least 8 characters";
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return "Password must be at most 128 characters";
  }

  const lowered = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lowered)) {
    return "This password is too common — choose something more unique";
  }

  const localPart = context.email ? emailLocalPart(context.email) : "";
  if (localPart.length >= 3 && lowered.includes(localPart)) {
    return "Password cannot contain your email address";
  }

  if (context.fullName) {
    for (const token of nameTokens(context.fullName)) {
      if (lowered.includes(token)) {
        return "Password cannot contain your name";
      }
    }
  }

  return null;
}

export function getPasswordHint(): string {
  return "Use at least 8 characters. Avoid common passwords and don't include your name or email.";
}
