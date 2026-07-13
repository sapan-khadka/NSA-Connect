/**
 * Canonical major labels and safe abbreviation aliases.
 *
 * Only include abbreviation mappings that are unambiguous
 * (e.g. CS → Computer Science). Do not silently merge ambiguous abbreviations.
 */

const MAJOR_ALIASES: Record<string, string> = {
  cs: "Computer Science",
  "c.s.": "Computer Science",
  "c.s": "Computer Science",
  "computer science": "Computer Science",
};

export function normalizeMajor(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (MAJOR_ALIASES[lower]) {
    return MAJOR_ALIASES[lower];
  }

  return lower
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function uniqueNormalizedMajors(majors: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const major of majors) {
    const normalized = normalizeMajor(major);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result.sort((a, b) => a.localeCompare(b));
}

export function memberMatchesMajors(
  member: { major?: string | null },
  selectedMajors: string[],
): boolean {
  if (selectedMajors.length === 0) {
    return true;
  }
  if (!member.major) {
    return false;
  }
  const normalized = normalizeMajor(member.major);
  return selectedMajors.some(
    (selected) => normalizeMajor(selected) === normalized,
  );
}
