export type SeasonalVariant = "default" | "dashain" | "tihar" | "holi";

export type SeasonalTheme = {
  variant: SeasonalVariant;
  heroClass: string;
  accentBorder: string;
};

type SeasonWindow = {
  variant: Exclude<SeasonalVariant, "default">;
  start: string;
  end: string;
  heroClass: string;
  accentBorder: string;
};

const DEFAULT_THEME: SeasonalTheme = {
  variant: "default",
  heroClass: "nepali-hero",
  accentBorder: "border-primary/15",
};

const SEASON_WINDOWS: SeasonWindow[] = [
  {
    variant: "holi",
    start: "03-01",
    end: "03-20",
    heroClass:
      "nepali-hero bg-gradient-to-br from-surface-muted via-surface to-mint/20",
    accentBorder: "border-accent/40",
  },
  {
    variant: "dashain",
    start: "09-20",
    end: "10-15",
    heroClass:
      "nepali-hero bg-gradient-to-br from-surface-muted via-surface to-primary/5",
    accentBorder: "border-accent/40",
  },
  {
    variant: "tihar",
    start: "10-25",
    end: "11-08",
    heroClass:
      "nepali-hero bg-gradient-to-br from-surface-muted via-surface to-mint/30",
    accentBorder: "border-marigold/50",
  },
];

function monthDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function isWithinWindow(key: string, start: string, end: string): boolean {
  if (start <= end) {
    return key >= start && key <= end;
  }

  return key >= start || key <= end;
}

export function getSeasonalTheme(date: Date = new Date()): SeasonalTheme {
  const key = monthDayKey(date);
  const match = SEASON_WINDOWS.find((window) =>
    isWithinWindow(key, window.start, window.end),
  );

  if (!match) {
    return DEFAULT_THEME;
  }

  return {
    variant: match.variant,
    heroClass: match.heroClass,
    accentBorder: match.accentBorder,
  };
}
