import type { EventVolunteerSignupMember } from "../lib/events-api";

export const NEEDED_VOLUNTEER_ROLES = [
  "Setup",
  "Registration",
  "Photography",
  "Cleanup",
] as const;

export type NeededVolunteerRole = (typeof NEEDED_VOLUNTEER_ROLES)[number];

const ROLE_MATCHERS: {
  role: NeededVolunteerRole;
  pattern: RegExp;
}[] = [
  { role: "Setup", pattern: /\b(set[\s-]?up|decorat\w*|stage|arrange)\b/i },
  {
    role: "Registration",
    pattern: /\b(regist\w*|check[\s-]?in|front[\s-]?desk|welcome|sign[\s-]?in)\b/i,
  },
  {
    role: "Photography",
    pattern: /\b(photo\w*|camera|film|media|video)\b/i,
  },
  {
    role: "Cleanup",
    pattern: /\b(clean\w*|tear[\s-]?down|pack[\s-]?up|breakdown)\b/i,
  },
];

/** Infer a display role from the volunteer note when no role API exists. */
export function inferVolunteerRole(
  note: string | null | undefined,
): string {
  const text = note?.trim() ?? "";
  if (!text) {
    return "General help";
  }
  for (const matcher of ROLE_MATCHERS) {
    if (matcher.pattern.test(text)) {
      return matcher.role;
    }
  }
  return "General help";
}

export function filledNeededRoles(
  signups: EventVolunteerSignupMember[],
): Set<NeededVolunteerRole> {
  const filled = new Set<NeededVolunteerRole>();
  for (const signup of signups) {
    const role = inferVolunteerRole(signup.note);
    if ((NEEDED_VOLUNTEER_ROLES as readonly string[]).includes(role)) {
      filled.add(role as NeededVolunteerRole);
    }
  }
  return filled;
}

export function volunteerInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
