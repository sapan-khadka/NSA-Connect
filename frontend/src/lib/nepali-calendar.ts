import NepaliDate from "nepali-date-converter";

export type NepaliFestival = {
  id: string;
  name: string;
};

type FestivalRange = NepaliFestival & {
  start: string;
  end: string;
};

/** Major festivals as inclusive Gregorian date ranges (2024–2032). */
const FESTIVAL_RANGES: FestivalRange[] = [
  { id: "new-year", name: "Nepali New Year", start: "2024-04-13", end: "2024-04-13" },
  { id: "holi", name: "Holi", start: "2024-03-25", end: "2024-03-25" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2024-05-23", end: "2024-05-23" },
  { id: "teej", name: "Teej", start: "2024-09-06", end: "2024-09-06" },
  { id: "dashain", name: "Dashain", start: "2024-10-03", end: "2024-10-12" },
  { id: "tihar", name: "Tihar", start: "2024-10-31", end: "2024-11-03" },

  { id: "new-year", name: "Nepali New Year", start: "2025-04-14", end: "2025-04-14" },
  { id: "holi", name: "Holi", start: "2025-03-14", end: "2025-03-14" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2025-05-12", end: "2025-05-12" },
  { id: "teej", name: "Teej", start: "2025-08-27", end: "2025-08-27" },
  { id: "dashain", name: "Dashain", start: "2025-09-22", end: "2025-10-02" },
  { id: "tihar", name: "Tihar", start: "2025-10-21", end: "2025-10-24" },

  { id: "new-year", name: "Nepali New Year", start: "2026-04-14", end: "2026-04-14" },
  { id: "holi", name: "Holi", start: "2026-03-03", end: "2026-03-03" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2026-05-01", end: "2026-05-01" },
  { id: "teej", name: "Teej", start: "2026-09-14", end: "2026-09-14" },
  { id: "dashain", name: "Dashain", start: "2026-10-11", end: "2026-10-20" },
  { id: "tihar", name: "Tihar", start: "2026-11-09", end: "2026-11-12" },

  { id: "new-year", name: "Nepali New Year", start: "2027-04-14", end: "2027-04-14" },
  { id: "holi", name: "Holi", start: "2027-03-22", end: "2027-03-22" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2027-05-20", end: "2027-05-20" },
  { id: "teej", name: "Teej", start: "2027-09-03", end: "2027-09-03" },
  { id: "dashain", name: "Dashain", start: "2027-09-30", end: "2027-10-09" },
  { id: "tihar", name: "Tihar", start: "2027-10-29", end: "2027-11-01" },

  { id: "new-year", name: "Nepali New Year", start: "2028-04-13", end: "2028-04-13" },
  { id: "holi", name: "Holi", start: "2028-03-11", end: "2028-03-11" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2028-05-08", end: "2028-05-08" },
  { id: "teej", name: "Teej", start: "2028-08-23", end: "2028-08-23" },
  { id: "dashain", name: "Dashain", start: "2028-10-18", end: "2028-10-27" },
  { id: "tihar", name: "Tihar", start: "2028-11-16", end: "2028-11-19" },

  { id: "new-year", name: "Nepali New Year", start: "2029-04-14", end: "2029-04-14" },
  { id: "holi", name: "Holi", start: "2029-02-28", end: "2029-02-28" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2029-05-27", end: "2029-05-27" },
  { id: "teej", name: "Teej", start: "2029-09-12", end: "2029-09-12" },
  { id: "dashain", name: "Dashain", start: "2029-10-07", end: "2029-10-16" },
  { id: "tihar", name: "Tihar", start: "2029-11-05", end: "2029-11-08" },

  { id: "new-year", name: "Nepali New Year", start: "2030-04-14", end: "2030-04-14" },
  { id: "holi", name: "Holi", start: "2030-03-20", end: "2030-03-20" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2030-05-17", end: "2030-05-17" },
  { id: "teej", name: "Teej", start: "2030-09-01", end: "2030-09-01" },
  { id: "dashain", name: "Dashain", start: "2030-09-26", end: "2030-10-05" },
  { id: "tihar", name: "Tihar", start: "2030-10-25", end: "2030-10-28" },

  { id: "new-year", name: "Nepali New Year", start: "2031-04-14", end: "2031-04-14" },
  { id: "holi", name: "Holi", start: "2031-03-09", end: "2031-03-09" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2031-05-06", end: "2031-05-06" },
  { id: "teej", name: "Teej", start: "2031-08-21", end: "2031-08-21" },
  { id: "dashain", name: "Dashain", start: "2031-10-16", end: "2031-10-25" },
  { id: "tihar", name: "Tihar", start: "2031-11-14", end: "2031-11-17" },

  { id: "new-year", name: "Nepali New Year", start: "2032-04-13", end: "2032-04-13" },
  { id: "holi", name: "Holi", start: "2032-02-27", end: "2032-02-27" },
  { id: "buddha-jayanti", name: "Buddha Jayanti", start: "2032-05-25", end: "2032-05-25" },
  { id: "teej", name: "Teej", start: "2032-09-08", end: "2032-09-08" },
  { id: "dashain", name: "Dashain", start: "2032-10-04", end: "2032-10-13" },
  { id: "tihar", name: "Tihar", start: "2032-11-02", end: "2032-11-05" },
];

export const FESTIVAL_DAY_CLASS = "bg-accent/10 hover:bg-accent/15";
export const FESTIVAL_DAY_SELECTED_CLASS =
  "bg-accent/20 ring-2 ring-inset ring-accent";
export const FESTIVAL_DAY_MUTED_CLASS = "bg-accent/5";

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isDateInRange(isoDate: string, start: string, end: string): boolean {
  const value = parseIsoDate(isoDate).getTime();
  return (
    value >= parseIsoDate(start).getTime() && value <= parseIsoDate(end).getTime()
  );
}

export function toBikramSambat(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const nepali = NepaliDate.fromAD(new Date(year, month - 1, day));
  return nepali.format("DD MMM");
}

export function getFestivalsOnDate(isoDate: string): NepaliFestival[] {
  const seen = new Set<string>();
  const festivals: NepaliFestival[] = [];

  for (const range of FESTIVAL_RANGES) {
    if (!isDateInRange(isoDate, range.start, range.end)) {
      continue;
    }

    const key = `${range.id}:${range.name}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    festivals.push({ id: range.id, name: range.name });
  }

  return festivals;
}

export function getFestivalDayCellClass(options: {
  isSelected: boolean;
  isCurrentMonth: boolean;
}): string {
  const { isSelected, isCurrentMonth } = options;

  if (!isCurrentMonth) {
    return FESTIVAL_DAY_MUTED_CLASS;
  }

  if (isSelected) {
    return FESTIVAL_DAY_SELECTED_CLASS;
  }

  return FESTIVAL_DAY_CLASS;
}
