export type SemesterTerm = "spring" | "summer" | "fall";

export function getCurrentSemesterSlug(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 1 && month <= 5) {
    return `${year}-spring`;
  }

  if (month >= 6 && month <= 7) {
    return `${year}-summer`;
  }

  return `${year}-fall`;
}

export function formatSemesterLabel(slug: string): string {
  const [year, term] = slug.split("-");
  const label = term.charAt(0).toUpperCase() + term.slice(1);
  return `${label} ${year}`;
}

export function getRecentSemesterOptions(count = 6, date = new Date()): string[] {
  const options: string[] = [];
  let cursor = getCurrentSemesterSlug(date);

  for (let index = 0; index < count; index += 1) {
    options.push(cursor);
    cursor = getPreviousSemesterSlug(cursor);
  }

  return options;
}

function getPreviousSemesterSlug(slug: string): string {
  const [yearStr, term] = slug.split("-") as [string, SemesterTerm];
  const year = Number.parseInt(yearStr, 10);

  if (term === "spring") {
    return `${year - 1}-fall`;
  }

  if (term === "summer") {
    return `${year}-spring`;
  }

  return `${year}-summer`;
}
